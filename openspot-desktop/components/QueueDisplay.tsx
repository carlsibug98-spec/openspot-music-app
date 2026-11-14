import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GestureHandlerRootView, FlatList as GestureFlatList } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams, DragEndParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';

import { Track } from '@/types/music';
import { MusicAPI } from '@/lib/music-api';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from 'react-i18next';

interface MusicQueueInterface {
  tracks: Track[];
  currentIndex: number;
  isShuffled: boolean;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  removeFromQueue: (index: number) => void;
  toggleShuffle: () => boolean;
  clearQueue: () => void;
}

interface QueueDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  musicQueue: MusicQueueInterface;
  onTrackSelect: (track: Track, index: number) => void;
  currentTrack: Track | null;
}

export function QueueDisplay({
  isOpen,
  onClose,
  musicQueue,
  onTrackSelect,
  currentTrack,
}: QueueDisplayProps) {
  const { isLiked, toggleLike } = useLikedSongs();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const flatListRef = useRef<GestureFlatList<Track>>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Stable per-entry keys so reordering animates instead of remounting rows.
  const itemKeys = useRef(new WeakMap<Track, string>());
  const keyCounter = useRef(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const theme = useMemo(
    () => ({
      base: isDark ? '#000000' : '#f5efe6',
      glass: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
      glassBorder: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
      textPrimary: isDark ? '#ffffff' : '#1a1a1a',
      textSecondary: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
      accent: isDark ? '#1DB954' : '#167c3a',
      track: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
      icon: isDark ? '#ffffff' : '#1a1a1a',
    }),
    [isDark]
  );

  useEffect(() => {
    if (isOpen && musicQueue.tracks.length > 0) {
      const scrollIndex = Math.max(0, musicQueue.currentIndex - 3);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: scrollIndex,
          animated: true,
          viewPosition: 0,
        });
      }, 100);
    }
  }, [isOpen, musicQueue.currentIndex, musicQueue.tracks.length]);

  const handleDragBegin = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const keyExtractor = useCallback((item: Track) => {
    const keys = itemKeys.current;
    let key = keys.get(item);
    if (!key) {
      key = `queue-item-${keyCounter.current++}`;
      keys.set(item, key);
    }
    return key;
  }, []);

  const handleDragEnd = useCallback(
    ({ from, to }: DragEndParams<Track>) => {
      setActiveIndex(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      musicQueue.moveQueueItem(from, to);
    },
    [musicQueue]
  );

  const renderTrackItem = useCallback(
    ({ item, getIndex, drag, isActive }: RenderItemParams<Track>) => {
      const index = getIndex() ?? 0;
      const isCurrentTrack = musicQueue.currentIndex === index;
      const isTrackLiked = isLiked(item.id);
      const isDimmed = activeIndex !== null && !isActive;

      return (
        <TouchableOpacity
          style={[
            styles.trackItem,
            isLandscape && styles.trackItemLandscape,
            isCurrentTrack && [styles.currentTrackItem, { backgroundColor: theme.glass }],
            isActive && [
              styles.draggingItem,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            ],
            isDimmed && styles.dimmedItem,
          ]}
          onPress={() => onTrackSelect(item, index)}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            drag();
          }}
          delayLongPress={200}
        >
          <View style={styles.trackNumber}>
            <Text
              style={[
                styles.trackNumberText,
                { color: theme.textSecondary },
                isCurrentTrack && { color: theme.accent },
              ]}
            >
              {index + 1}
            </Text>
          </View>

          <Image
            source={{ uri: MusicAPI.getOptimalImage(item.images) }}
            style={styles.albumCover}
            contentFit="cover"
          />

          <View style={styles.trackInfo}>
            <Text
              style={[
                styles.trackTitle,
                { color: theme.textPrimary },
                isCurrentTrack && { color: theme.accent },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.trackArtist,
                { color: theme.textSecondary },
                isCurrentTrack && { color: theme.accent },
              ]}
              numberOfLines={1}
            >
              {item.artist}
            </Text>
            <Text style={[styles.trackDuration, { color: theme.textSecondary }]}>
              {MusicAPI.formatDuration((item.duration ?? 0) / 1000)} {/* ✅ fallback */}
            </Text>
          </View>

          <View style={styles.trackActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike(item)}>
              <Ionicons
                name={isTrackLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={isTrackLiked ? theme.accent : theme.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => musicQueue.removeFromQueue(index)}>
              <Ionicons name="close-circle-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

            {isCurrentTrack && (
              <View style={styles.playingIndicator}>
                <Ionicons name="volume-high" size={16} color={theme.accent} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [theme, musicQueue, isLiked, toggleLike, onTrackSelect, isLandscape, activeIndex, isDark]
  );

  const renderHeader = () => (
    <View style={[styles.header, isLandscape && styles.headerLandscape]}>
      <LinearGradient
        colors={
          isDark
            ? ['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']
            : ['rgba(245,239,230,0.8)', 'rgba(245,239,230,0.95)']
        }
        style={[styles.headerGradient, isLandscape && styles.headerGradientLandscape]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.glass }]} onPress={onClose}>
            <Ionicons name="chevron-down" size={24} color={theme.icon} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, isLandscape && styles.headerTitleLandscape, { color: theme.textPrimary }]}>{t('components.queue')}</Text>
          <Text style={[styles.headerSubtitle, isLandscape && styles.headerSubtitleLandscape, { color: theme.textSecondary }]}>
            {musicQueue.tracks.length} {musicQueue.tracks.length !== 1 ? t('components.songs') : t('components.song')}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  const renderQueueControls = () => (
    <View style={[styles.queueControls, isLandscape && styles.queueControlsLandscape, { borderBottomColor: theme.glassBorder }]}>
      <TouchableOpacity
        style={[
          styles.controlButton,
          { backgroundColor: theme.glass },
          musicQueue.isShuffled && [styles.activeControlButton, { backgroundColor: theme.accent }],
        ]}
        onPress={musicQueue.toggleShuffle}
      >
        <Ionicons name="shuffle" size={20} color={musicQueue.isShuffled ? '#fff' : theme.textSecondary} />
        <Text
          style={[
            styles.controlButtonText,
            { color: theme.textSecondary },
            musicQueue.isShuffled && styles.activeControlButtonText,
          ]}
        >
          {t('components.shuffle')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.controlButton, { backgroundColor: theme.glass }]} onPress={musicQueue.clearQueue}>
        <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
        <Text style={[styles.controlButtonText, { color: theme.textSecondary }]}>{t('components.clear')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="list-outline" size={64} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{t('components.queue_empty')}</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>{t('components.queue_empty_hint')}</Text>
    </View>
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => {
      const itemHeight = isLandscape ? 54 : 70;
      return {
        length: itemHeight,
        offset: itemHeight * index,
        index,
      };
    },
    [isLandscape]
  );

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.container, { backgroundColor: theme.base }]}>
          <BlurView intensity={isDark ? 10 : 0} tint={isDark ? 'dark' : 'light'} style={styles.blurContainer}>
            {renderHeader()}
            {renderQueueControls()}

            {musicQueue.tracks.length === 0 ? (
              renderEmptyState()
            ) : (
              <DraggableFlatList
                ref={flatListRef}
                data={musicQueue.tracks}
                renderItem={renderTrackItem}
                keyExtractor={keyExtractor}
                onDragBegin={handleDragBegin}
                onDragEnd={handleDragEnd}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.listContainer, isLandscape && styles.listContainerLandscape]}
                getItemLayout={getItemLayout}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
              />
            )}
          </BlurView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  blurContainer: { flex: 1 },
  header: { paddingTop: 20, paddingBottom: 10 },
  headerLandscape: { paddingTop: 8, paddingBottom: 4 },
  headerGradient: { paddingVertical: 20 },
  headerGradientLandscape: { paddingVertical: 12 },
  headerContent: { alignItems: 'center' },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  headerTitleLandscape: { fontSize: 18, marginBottom: 4 },
  headerSubtitle: { fontSize: 16 },
  headerSubtitleLandscape: { fontSize: 14 },
  queueControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  queueControlsLandscape: {
    paddingVertical: 8,
  },
  controlButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  activeControlButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  controlButtonText: { fontSize: 12, marginLeft: 6 },
  activeControlButtonText: { fontSize: 12, marginLeft: 6 },
  listContainer: { paddingVertical: 8 },
  listContainerLandscape: { paddingVertical: 4 },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    marginHorizontal: 4,
  },
  trackItemLandscape: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  currentTrackItem: {},
  draggingItem: {
    transform: [{ scale: 1.02 }],
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  dimmedItem: { opacity: 0.45 },
  trackNumber: { width: 24, alignItems: 'center', marginRight: 12 },
  trackNumberText: { fontSize: 14 },
  albumCover: { width: 40, height: 40, borderRadius: 4, marginRight: 12 },
  trackInfo: { flex: 1, justifyContent: 'center' },
  trackTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  trackArtist: { fontSize: 12, marginBottom: 2 },
  trackDuration: { fontSize: 10 },
  trackActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { padding: 8, marginLeft: 4 },
  playingIndicator: { marginLeft: 8, padding: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
});