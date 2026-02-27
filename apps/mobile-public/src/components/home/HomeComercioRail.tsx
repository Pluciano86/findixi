import { useEffect, useMemo, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { HomeComercioCard } from '../../features/home/types';
import { borderRadius, fonts, shadows, spacing } from '../../theme/tokens';

type HomeComercioRailProps = {
  items: HomeComercioCard[];
  emptyText: string;
  autoplayDirection?: 'forward' | 'reverse';
};

const CARD_WIDTH = 228;
const CARD_GAP = spacing.sm;
const CARD_STEP = CARD_WIDTH + CARD_GAP;
const AUTO_SCROLL_MS = 3000;
const LOOP_COPIES = 3;

export function HomeComercioRail({
  items,
  emptyText,
  autoplayDirection = 'forward',
}: HomeComercioRailProps) {
  const router = useRouter();
  const listRef = useRef<FlatList<HomeComercioCard>>(null);
  const currentIndexRef = useRef(0);
  const loopItems = useMemo(() => {
    if (items.length <= 1) return items;
    return Array.from({ length: LOOP_COPIES }, () => items).flat();
  }, [items]);

  const segmentSize = items.length;
  const middleStartIndex = segmentSize;
  const middleEndIndex = segmentSize * 2 - 1;

  function recenterIndex(index: number): number {
    if (segmentSize <= 1) return Math.max(index, 0);
    if (index < middleStartIndex) return index + segmentSize;
    if (index > middleEndIndex) return index - segmentSize;
    return index;
  }

  useEffect(() => {
    const startIndex =
      autoplayDirection === 'reverse' && segmentSize > 1
        ? middleEndIndex
        : segmentSize > 1
          ? middleStartIndex
          : 0;
    currentIndexRef.current = startIndex;
    listRef.current?.scrollToOffset({ offset: startIndex * CARD_STEP, animated: false });
  }, [autoplayDirection, middleEndIndex, middleStartIndex, segmentSize]);

  useEffect(() => {
    if (segmentSize <= 1) return;
    const lastLoopIndex = Math.max(loopItems.length - 1, 0);

    const timerId = setInterval(() => {
      const isReverse = autoplayDirection === 'reverse';
      const delta = isReverse ? -1 : 1;
      const rawNextIndex = currentIndexRef.current + delta;
      const nextIndex = Math.min(Math.max(rawNextIndex, 0), lastLoopIndex);
      currentIndexRef.current = nextIndex;
      listRef.current?.scrollToOffset({ offset: nextIndex * CARD_STEP, animated: true });
    }, AUTO_SCROLL_MS);

    return () => clearInterval(timerId);
  }, [autoplayDirection, loopItems.length, segmentSize]);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const rawOffset = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(rawOffset / CARD_STEP);
    const clampedIndex = Math.min(Math.max(nextIndex, 0), Math.max(loopItems.length - 1, 0));
    const recenteredIndex = recenterIndex(clampedIndex);
    currentIndexRef.current = recenteredIndex;

    if (recenteredIndex !== clampedIndex) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: recenteredIndex * CARD_STEP, animated: false });
      });
    }
  }

  if (!items.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      horizontal
      data={loopItems}
      keyExtractor={(item, index) => `${item.id}-${index}`}
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_STEP}
      decelerationRate="fast"
      disableIntervalMomentum
      contentContainerStyle={styles.track}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      onMomentumScrollEnd={handleMomentumEnd}
      getItemLayout={(_, index) => ({
        index,
        length: CARD_STEP,
        offset: CARD_STEP * index,
      })}
      onScrollToIndexFailed={({ index }) => {
        listRef.current?.scrollToOffset({ offset: CARD_STEP * index, animated: false });
      }}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      updateCellsBatchingPeriod={40}
      windowSize={4}
      removeClippedSubviews
      renderItem={({ item }) => (
        <Pressable
          style={[styles.card, shadows.card]}
          onPress={() => router.push({ pathname: '/comercio/[id]', params: { id: String(item.id) } })}
        >
          <Image source={{ uri: item.coverUrl }} style={styles.cover} resizeMode="cover" />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(2,6,23,0.88)', 'rgba(2,6,23,0.52)', 'rgba(2,6,23,0.0)']}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.gradient}
          />
          <View style={styles.overlay}>
            <Image source={{ uri: item.logoUrl }} style={styles.logo} resizeMode="cover" />
            <View style={styles.textWrap}>
              <Text style={styles.name} numberOfLines={1}>{item.nombre}</Text>
              <Text style={styles.municipio} numberOfLines={1}>{item.municipio}</Text>
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  track: {
    paddingHorizontal: spacing.lg,
  },
  separator: {
    width: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: 152,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
  },
  overlay: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
  },
  textWrap: {
    flex: 1,
  },
  name: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  municipio: {
    color: '#e2e8f0',
    fontSize: 12,
    marginTop: 1,
    fontFamily: fonts.regular,
  },
  emptyWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
});
