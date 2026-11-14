import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  StatusBar,
  Alert,
  Animated,
  Easing,
  AppState,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Slider } from '@sharcoux/slider';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Track } from '../types/music';
import { useLikedSongs } from '../hooks/useLikedSongs';
import { PlaylistStorage, Playlist } from '@/lib/playlist-storage';
import { DownloadButton } from './DownloadButton';
import { Colors } from '@/constants/Colors';
import { gradientPairFor } from '../lib/now-playing-theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from 'react-i18next';
import TrackPlayer, { RepeatMode } from 'react-native-track-player';

const ROTATING_COVER_KEY = 'openspot_rotating_cover_v1';

const ANIMATION_DURATION = 500;
const SUCCESS_TOAST_DURATION = 2000;
const TABLET_BREAKPOINT = 768;

const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=');
};

const formatTime = (millis: number): string => {
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface FullScreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  position: number;
  duration: number;
  onSeek: (value: number) => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffle: () => void;
  musicQueue?: any;
  onQueueToggle?: () => void;
  onPlaylistsUpdated?: () => void;
}

export function FullScreenPlayer({
  isOpen,
  onClose,
  track,
  isPlaying,
  onPlayingChange,
  position,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  onNext,
  onPrevious,
  onShuffle,
  musicQueue,
  onQueueToggle,
  onPlaylistsUpdated,
}: FullScreenPlayerProps) {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isTablet = windowWidth >= TABLET_BREAKPOINT;
  const isLandscape = windowWidth > windowHeight;

  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const { isLiked, toggleLike } = useLikedSongs();
  const { t } = useTranslation();

  const theme = useMemo(
    () => ({
      base: isDark ? '#0a0a0f' : '#f0ebe3',
      glass: isDark ? 'rgba(30,30,45,0.85)' : 'rgba(200,195,185,0.6)',
      glassBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)',
      textPrimary: isDark ? '#ffffff' : '#1e1e2a',
      textSecondary: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.7)',
      accent: Colors.theme.island.accent.dark,
      accentGlow: isDark ? 'rgba(29,185,84,0.3)' : 'rgba(29,185,84,0.15)',
      track: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
      icon: isDark ? '#ffffff' : '#1e1e2a',
      shadow: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.1)',
      danger: Colors.theme.danger[isDark ? 'dark' : 'light'],
    }),
    [isDark]
  );

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.Off);
  const [rotatingCover, setRotatingCover] = useState<boolean>(true);

  const albumScaleAnim = useRef(new Animated.Value(1)).current;
  const likeScaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const rotationLoop = useRef<Animated.CompositeAnimation | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRotation = useCallback(() => {
    if (rotationLoop.current) return;

    rotationLoop.current = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 360,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotationLoop.current.start();
  }, [rotateAnim]);

  const stopRotation = useCallback(() => {
    rotationLoop.current?.stop();
    rotationLoop.current = null;
    rotateAnim.setValue(0);
  }, [rotateAnim]);

  useEffect(() => {
    if (!track) return;
    const loadPlaylists = async () => {
      const pls = await PlaylistStorage.getPlaylists();
      setPlaylists(pls);
      const preSel = pls
        .filter(pl => pl.trackIds.includes(track.id.toString()))
        .map(pl => pl.name);
      setSelected(preSel);
    };
    loadPlaylists();
  }, [track]);

  useEffect(() => {
    stopRotation();
    if (isPlaying && rotatingCover) {
      rotationLoop.current = null;
      startRotation();
    }
  }, [isPlaying, rotatingCover, startRotation, stopRotation]);

  useEffect(() => {
    if (isOpen) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start();
      TrackPlayer.getRepeatMode().then(setRepeatMode).catch(() => {});
      AsyncStorage.getItem(ROTATING_COVER_KEY).then((stored) => {
        const enabled = stored !== null ? stored === 'true' : true;
        setRotatingCover(enabled);
        if (enabled && isPlaying) {
          rotationLoop.current = null;
          startRotation();
        }
      }).catch(() => {});
    } else {
      fadeAnim.setValue(0);
    }
  }, [isOpen, fadeAnim, isPlaying, startRotation, rotationLoop]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isPlaying) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(albumScaleAnim, {
            toValue: 1.02,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(albumScaleAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      albumScaleAnim.stopAnimation();
      albumScaleAnim.setValue(1);
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [isPlaying, albumScaleAnim]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const loadRotatingCover = async () => {
      try {
        const stored = await AsyncStorage.getItem(ROTATING_COVER_KEY);
        if (stored !== null) {
          setRotatingCover(stored === 'true');
        }
      } catch (error) {
        console.error('Failed to load rotating cover setting:', error);
      }
    };
    loadRotatingCover();
  }, []);

  useEffect(() => {
    if (isPlaying && rotatingCover) {
      startRotation();
    } else {
      stopRotation();
    }
  }, [isPlaying, rotatingCover, startRotation, stopRotation]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && isPlaying && rotatingCover) {
        rotationLoop.current = null;
        startRotation();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isPlaying, rotatingCover, startRotation]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  const handlePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPlayingChange(!isPlaying);
  }, [isPlaying, onPlayingChange]);

  const handlePrevious = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPrevious();
  }, [onPrevious]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext();
  }, [onNext]);

  const handleLike = useCallback(() => {
    if (!track) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(likeScaleAnim, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(likeScaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    toggleLike(track);
  }, [track, toggleLike, likeScaleAnim]);

  const handleShufflePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onShuffle();
  }, [onShuffle]);

  const handleQueueToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onQueueToggle?.();
  }, [onQueueToggle]);

  const handleArtistPress = useCallback(() => {
    if (!track) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    router.push({
      pathname: '/search',
      params: { q: track.artist, type: 'artist' }
    });
  }, [router, track, onClose]);

  const handleSliderStart = useCallback(() => {
    setIsSeeking(true);
    setSeekPosition(position);
  }, [position]);

  const handleSliderChange = useCallback((value: number) => {
    setSeekPosition(value);
  }, []);

  const handleSliderComplete = useCallback((value: number) => {
    onSeek(value);
    setIsSeeking(false);
  }, [onSeek]);

  const handleRepeatToggle = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMode =
      repeatMode === RepeatMode.Off
        ? RepeatMode.Track
        : repeatMode === RepeatMode.Track
          ? RepeatMode.Queue
          : RepeatMode.Off;

    try {
      await TrackPlayer.setRepeatMode(newMode);
      setRepeatMode(newMode);
    } catch (_e) {
      console.debug('TrackPlayer not ready, repeat mode change ignored', _e);
    }
  }, [repeatMode]);

  const getRepeatIcon = useCallback(() => {
    return repeatMode !== RepeatMode.Off ? 'repeat' : 'repeat-outline';
  }, [repeatMode]);

  const toggleSelect = useCallback((name: string) => {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }, []);

  const handleAddToPlaylist = useCallback(async () => {
    if (!track) return;
    setAdding(true);
    try {
      await PlaylistStorage.addTrackToPlaylists(track, selected);

      const toRemove = playlists.filter(
        pl => !selected.includes(pl.name) && pl.trackIds.includes(track.id.toString())
      );

      for (const pl of toRemove) {
        await PlaylistStorage.removeTrackFromPlaylist(track.id.toString(), pl.name);
      }

      setAddSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(() => {
        setAddSuccess(false);
        setShowAddModal(false);
      }, SUCCESS_TOAST_DURATION);

      onPlaylistsUpdated?.();

      const updated = await PlaylistStorage.getPlaylists();
      setPlaylists(updated);
      const newSelected = updated
        .filter(pl => pl.trackIds.includes(track.id.toString()))
        .map(pl => pl.name);
      setSelected(newSelected);
    } catch (_e) {
      Alert.alert(t('components.error'), t('components.playlist_update_failed'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error(_e);
    } finally {
      setAdding(false);
    }
  }, [track, selected, playlists, onPlaylistsUpdated, t]);

  const openPlaylistModal = useCallback(async () => {
    if (!track) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pls = await PlaylistStorage.getPlaylists();
    setPlaylists(pls);
    const preSel = pls
      .filter(pl => pl.trackIds.includes(track.id.toString()))
      .map(pl => pl.name);
    setSelected(preSel);
    setShowAddModal(true);
  }, [track]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      setToastType(null);
    }, SUCCESS_TOAST_DURATION);
  }, []);

  if (!track) return null;

  const displayedPosition = isSeeking ? seekPosition : position;

  const availablePlaylists = playlists.filter(p => p.name !== 'offline');
  const hasPlaylists = availablePlaylists.length > 0;
  const hasSelection = selected.length > 0;

  const albumSize = isLandscape
    ? isTablet
      ? Math.min(windowHeight * 0.55, 320)
      : Math.min(windowHeight * 0.5, 220)
    : isTablet
      ? Math.min(windowWidth * 0.5, 380)
      : windowWidth * 0.68;

  const PlaylistModal = (
    <Modal
      visible={showAddModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAddModal(false)}
    >
      <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: isDark ? '#1c1c24' : '#fff' }]}>
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
            {t('components.add_to_playlist') || 'Add to Playlist'}
          </Text>
          {hasPlaylists ? (
            <FlatList
              data={availablePlaylists}
              keyExtractor={item => item.name}
              style={{ width: '100%', maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, { backgroundColor: theme.glass }]}
                  onPress={() => toggleSelect(item.name)}
                >
                  <Ionicons
                    name={selected.includes(item.name) ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={selected.includes(item.name) ? theme.accent : theme.textSecondary}
                  />
                  <Text style={{ color: theme.textPrimary, marginLeft: 12 }}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.emptyPlaylistContainer}>
              <Ionicons name="musical-notes" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyPlaylistText, { color: theme.textSecondary }]}>
                {t('components.no_playlists_yet') || 'Go to library and create your first playlist'}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.modalButton,
              { backgroundColor: hasSelection ? theme.accent : theme.track },
              (!hasSelection || adding) && styles.modalButtonDisabled,
            ]}
            onPress={handleAddToPlaylist}
            disabled={!hasSelection || adding}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
              {adding ? (t('components.updating') || 'Updating...') : (t('components.update') || 'Update')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalCancel}
            onPress={() => setShowAddModal(false)}
          >
            <Text style={[styles.modalCancelText, { color: theme.textPrimary }]}>
              {t('components.cancel') || 'Cancel'}
            </Text>
          </TouchableOpacity>
          {addSuccess && (
            <Text style={{ color: theme.accent, marginTop: 10 }}>
              {t('components.added_to_playlist') || 'Playlists updated!'}
            </Text>
          )}
        </View>
      </BlurView>
    </Modal>
  );

  const Toast = (() => {
    if (!toastMessage) return null;
    const isSuccess = toastType === 'success';
    return (
      <Animated.View
        style={[
          styles.toastContainer,
          { backgroundColor: isSuccess ? theme.accent : theme.danger, opacity: fadeAnim },
        ]}
      >
        <Ionicons
          name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
          size={24}
          color="#fff"
          style={styles.toastIcon}
        />
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>
    );
  })();

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.base }]}>
          <StatusBar
            barStyle="light-content"
            backgroundColor="transparent"
            translucent
          />

          {Toast}

          <View style={styles.backgroundContainer}>
            <LinearGradient
              colors={gradientPairFor(track.id).colors}
              style={styles.gradient}
            />
          </View>

          <Animated.View style={[styles.mainContent, { opacity: fadeAnim }]}>
            {/* Header: chevron · eyebrow · 3-dot (menu wired in the overflow-menu task) */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel={t('components.back') || 'Back'}
              >
                <View style={styles.headerButtonCircle}>
                  <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.9)" />
                </View>
              </TouchableOpacity>
              <Text style={styles.headerEyebrow} numberOfLines={1}>
                {t('player.now_playing') || 'Now Playing'}
              </Text>
              <TouchableOpacity
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel="More options"
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>

            {/* --- FIX 3: Landscape layout — explicit sizing so artwork & slider are always visible --- */}
            <View style={[
              styles.content,
              isLandscape ? styles.contentLandscape : styles.contentPortrait,
            ]}>
              {/* Album Art */}
              <View style={[
                styles.albumArtContainer,
                isLandscape && { width: albumSize, height: albumSize, marginBottom: 0, flexShrink: 0 },
              ]}>
                <Animated.View
                  style={[
                    {
                      borderRadius: 24,
                      padding: 4,
                      width: albumSize,
                      height: albumSize,
                    },
                    { transform: [{ scale: albumScaleAnim }] },
                  ]}
                >
                  <View style={styles.albumArtShadowRing} />
                  <Animated.View
                    style={[
                      styles.albumArtGlass,
                      rotatingCover && { transform: [{ rotate: spin }] },
                    ]}
                  >
                    <Image
                      source={{ uri: (track as any).offlineThumbUri || track.images.large }}
                      style={styles.albumArt}
                      contentFit="cover"
                    />
                  </Animated.View>
                </Animated.View>
              </View>

              {/* Right panel: info + controls */}
              <View style={[
                styles.rightPanel,
                isLandscape && styles.rightPanelLandscape,
              ]}>
                {/* Track info: left-aligned title/artist; download + heart right (spec Part 2) */}
                <View style={[styles.trackInfo, isLandscape && styles.trackInfoLandscape]}>
                  <View style={styles.trackInfoText}>
                    <Text
                      style={[
                        styles.trackTitle,
                        isLandscape && styles.trackTitleLandscape,
                      ]}
                      numberOfLines={1}
                    >
                      {decodeHtmlEntities(track.title)}
                    </Text>
                    <TouchableOpacity onPress={handleArtistPress}>
                      <Text
                        style={[
                          styles.trackArtist,
                          isLandscape && styles.trackArtistLandscape,
                          { color: theme.accent },
                        ]}
                        numberOfLines={1}
                      >
                        {decodeHtmlEntities(track.artist)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.trackInfoActions}>
                    <DownloadButton
                      track={track}
                      iconColor="rgba(255,255,255,0.75)"
                      accentColor={theme.accent}
                      showNotification={showToast}
                      iconSize={21}
                    />
                    <Animated.View style={{ transform: [{ scale: likeScaleAnim }] }}>
                      <TouchableOpacity onPress={handleLike} style={styles.trackHeartButton}>
                        <Ionicons
                          name={isLiked(track.id) ? 'heart' : 'heart-outline'}
                          size={22}
                          color={isLiked(track.id) ? theme.accent : '#ffffff'}
                        />
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </View>

                {/* Seek bar */}
                <View style={[styles.progressContainer, isLandscape && styles.progressContainerLandscape]}>
                  <View style={styles.progressBar}>
                    <Text style={[styles.timeText, { color: 'rgba(255,255,255,0.55)' }]}>
                      {formatTime(displayedPosition)}
                    </Text>
                    <View style={styles.sliderContainer}>
                      <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={duration}
                        value={displayedPosition}
                        onValueChange={handleSliderChange}
                        onSlidingStart={handleSliderStart}
                        onSlidingComplete={handleSliderComplete}
                        minimumTrackTintColor="#ffffff"
                        maximumTrackTintColor="rgba(255,255,255,0.2)"
                        thumbTintColor="#ffffff"
                        trackHeight={4}
                        thumbSize={20}
                      />
                    </View>
                    <Text style={[styles.timeText, { color: 'rgba(255,255,255,0.55)' }]}>
                      {formatTime(duration)}
                    </Text>
                  </View>
                </View>

                {/* Playback controls: shuffle · prev · play · next · repeat */}
                <View style={[styles.controls, isLandscape && styles.controlsLandscape]}>
                  <TouchableOpacity
                    onPress={handleShufflePress}
                    style={styles.controlButton}
                    accessibilityRole="button"
                    accessibilityLabel="Shuffle"
                  >
                    <Ionicons
                      name="shuffle"
                      size={22}
                      color={musicQueue?.isShuffled ? theme.accent : 'rgba(255,255,255,0.75)'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handlePrevious}
                    style={styles.controlButton}
                    accessibilityRole="button"
                    accessibilityLabel="Previous"
                  >
                    <Ionicons name="play-skip-back" size={22} color="rgba(255,255,255,0.75)" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handlePlayPause}
                    style={styles.playButton}
                    accessibilityRole="button"
                    accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                  >
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#000000" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleNext}
                    style={styles.controlButton}
                    accessibilityRole="button"
                    accessibilityLabel="Next"
                  >
                    <Ionicons name="play-skip-forward" size={22} color="rgba(255,255,255,0.75)" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleRepeatToggle}
                    style={styles.controlButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('components.repeat') || 'Repeat'}
                  >
                    <Ionicons
                      name={getRepeatIcon()}
                      size={22}
                      color={repeatMode !== RepeatMode.Off ? theme.accent : 'rgba(255,255,255,0.75)'}
                    />
                  </TouchableOpacity>
                </View>

                {/* Secondary row: queue toggle, right-aligned under repeat (spec Part 2) */}
                <View style={styles.secondaryRow}>
                  <TouchableOpacity
                    onPress={handleQueueToggle}
                    style={styles.secondaryButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('components.queue') || 'Queue'}
                  >
                    <Ionicons name="list" size={18} color="rgba(255,255,255,0.45)" />
                  </TouchableOpacity>
                </View>

                {/* --- FIX 2: Bottom buttons — always evenly spaced row, no overflow --- */}
                <View style={[
                  styles.bottomControls,
                  isLandscape ? styles.bottomControlsLandscape : styles.bottomControlsPortrait,
                ]}>
                  <TouchableOpacity
                    onPress={openPlaylistModal}
                    style={styles.miniButtonWithText}
                  >
                    <Ionicons name="add-circle" size={24} color="rgba(255,255,255,0.55)" />
                    <Text style={[styles.miniButtonText, { color: 'rgba(255,255,255,0.55)' }]}>
                      {t('components.add') || 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>

          {PlaylistModal}
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  gradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mainContent: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    zIndex: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginHorizontal: 4,
  },

  contentPortrait: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingTop: 20,
    zIndex: 1,
  },
 
  contentLandscape: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 20,
    zIndex: 1,
  },
 
  content: { flex: 1, zIndex: 1 },

  albumArtContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    width: '100%',
  },

  albumArtShadowRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 999,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
    zIndex: -1,
  },
  albumArtGlass: {
    borderRadius: 999,
    overflow: 'hidden',
    flex: 1,
  },
  albumArt: { width: '100%', height: '100%', borderRadius: 999 },

  rightPanel: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  rightPanelLandscape: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: undefined,
  },

  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 12,
    width: '100%',
  },
  trackInfoLandscape: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  trackInfoText: {
    flex: 1,
    minWidth: 0,
  },
  trackInfoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackHeartButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.4,
    lineHeight: 28,
    minHeight: 28,
    color: '#ffffff',
  },
  trackTitleLandscape: { fontSize: 18, lineHeight: 24, minHeight: 24 },
  trackArtist: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    minHeight: 16,
    alignSelf: 'flex-start',
  },
  trackArtistLandscape: { fontSize: 12, lineHeight: 16, minHeight: 16 },

  progressContainer: { marginBottom: 20, width: '100%', paddingHorizontal: 8 },
  progressContainerLandscape: { marginBottom: 10, paddingHorizontal: 4 },
  progressBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText: { fontSize: 12, width: 38, textAlign: 'center', fontWeight: '500' },
  sliderContainer: { flex: 1 },
  slider: { width: '100%', height: 40 },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  controlsLandscape: { marginBottom: 8, gap: 10 },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 8,
  },

  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  bottomControlsPortrait: {
    paddingHorizontal: 4,
    paddingBottom: 12,
    marginTop: 4,
  },
  bottomControlsLandscape: {
    paddingHorizontal: 4,
    paddingBottom: 4,
    marginTop: 4,
  },

  miniButtonWithText: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 56,
  },
  miniButtonText: { fontSize: 10, marginTop: 4, fontWeight: '500' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    borderRadius: 28,
    padding: 24,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    width: '100%',
    marginBottom: 8,
  },
  modalButton: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 40,
    alignItems: 'center',
  },
  modalButtonDisabled: { opacity: 0.5 },
  modalCancel: { marginTop: 12 },
  modalCancelText: { fontSize: 15 },
  emptyPlaylistContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyPlaylistText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  toastContainer: {
    position: 'absolute',
    top: 10,
    left: 24,
    right: 24,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    zIndex: 1000,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    marginHorizontal: 24,
  },
  toastIcon: { marginRight: 10 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '500', flex: 1 },
});