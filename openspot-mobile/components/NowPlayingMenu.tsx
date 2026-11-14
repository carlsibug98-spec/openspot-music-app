// NowPlayingMenu: overflow bottom sheet for the now-playing screen (spec Part 2,
// Task 7). Opens from the header 3-dot; dismissed by tapping the dim overlay or
// Android back — deliberately no visible Close button (user decision).
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Share,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Track } from '../types/music';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from 'react-i18next';

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

interface NowPlayingMenuProps {
  visible: boolean;
  onClose: () => void;
  onAddToPlaylist: () => void;
  track: Track | null;
}

export function NowPlayingMenu({ visible, onClose, onAddToPlaylist, track }: NowPlayingMenuProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const router = useRouter();

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  const sheetTheme = useMemo(
    () => ({
      bg: isDark ? '#1b1b1b' : '#fffaf2',
      grab: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
      textPrimary: isDark ? '#ffffff' : '#1e1e2a',
      textSecondary: isDark ? '#9a9a9a' : 'rgba(0,0,0,0.55)',
      icon: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.65)',
      itemText: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
    }),
    [isDark]
  );

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const handleAddToPlaylist = useCallback(() => {
    if (!track) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    onAddToPlaylist();
  }, [track, onClose, onAddToPlaylist]);

  const handleGoToAlbum = useCallback(() => {
    if (!track) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/media/[type]/[id]',
      params: { type: 'album', id: track.albumId },
    });
    onClose();
  }, [track, router, onClose]);

  const handleGoToArtist = useCallback(() => {
    if (!track) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/search',
      params: { q: track.artist, type: 'artist' },
    });
    onClose();
  }, [track, router, onClose]);

  const handleShare = useCallback(() => {
    if (!track) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void Share.share({
      message: `${track.title} — ${track.artist} · via OpenSpot`,
    });
    onClose();
  }, [track, onClose]);

  if (!track) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.dim, { opacity: fadeAnim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: sheetTheme.bg, transform: [{ translateY }] },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: sheetTheme.grab }]} />

          {/* Header: thumb + track identity */}
          <View style={styles.trackRow}>
            <Image source={{ uri: track.images.large }} style={styles.thumb} />
            <View style={styles.trackText}>
              <Text style={[styles.trackTitle, { color: sheetTheme.textPrimary }]} numberOfLines={1}>
                {decodeHtmlEntities(track.title)}
              </Text>
              <Text style={[styles.trackSubtitle, { color: sheetTheme.textSecondary }]} numberOfLines={1}>
                {decodeHtmlEntities(track.artist)}
              </Text>
            </View>
          </View>

          {/* Items: no dividers between items (user decision) */}
          <TouchableOpacity style={styles.item} onPress={handleAddToPlaylist}>
            <Ionicons name="add-circle-outline" size={20} color={sheetTheme.icon} />
            <Text style={[styles.itemText, { color: sheetTheme.itemText }]}>
              {t('components.add_to_playlist') || 'Add to playlist'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={handleGoToAlbum}>
            <Ionicons name="disc-outline" size={20} color={sheetTheme.icon} />
            <Text style={[styles.itemText, { color: sheetTheme.itemText }]}>
              {t('player.go_to_album') || 'Go to album'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={handleGoToArtist}>
            <Ionicons name="person-outline" size={20} color={sheetTheme.icon} />
            <Text style={[styles.itemText, { color: sheetTheme.itemText }]}>
              {t('player.go_to_artist') || 'Go to artist'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color={sheetTheme.icon} />
            <Text style={[styles.itemText, { color: sheetTheme.itemText }]}>
              {t('player.share_song') || 'Share song'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 14,
    paddingBottom: 26,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 4,
    alignSelf: 'center',
    marginBottom: 12,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  thumb: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  trackText: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  trackSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  itemText: {
    fontSize: 13.5,
    fontWeight: '500',
    flex: 1,
  },
});
