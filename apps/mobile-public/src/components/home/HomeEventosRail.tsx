import { useEffect, useMemo, useRef, useState } from 'react';
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

import type { HomeEventoCard } from '../../features/home/types';
import { useI18n } from '../../i18n/provider';
import { borderRadius, fonts, shadows, spacing } from '../../theme/tokens';

type HomeEventosRailProps = {
  items: HomeEventoCard[];
  onPressEvent?: (item: HomeEventoCard) => void;
};

type EventImageCardProps = {
  imageUrl: string;
};

const EVENT_CARD_WIDTH = 176;
const EVENT_CARD_GAP = spacing.sm;
const EVENT_CARD_STEP = EVENT_CARD_WIDTH + EVENT_CARD_GAP;
const AUTO_SCROLL_MS = 2500;
const LOOP_COPIES = 3;
const imageOrientationCache = new Map<string, boolean>();

function EventImageCard({ imageUrl }: EventImageCardProps) {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const cached = imageOrientationCache.get(imageUrl);
    if (typeof cached === 'boolean') {
      setIsLandscape(cached);
      return;
    }

    let active = true;
    Image.getSize(
      imageUrl,
      (width, height) => {
        if (!active) return;
        const next = width > height;
        imageOrientationCache.set(imageUrl, next);
        setIsLandscape(next);
      },
      () => {
        if (!active) return;
        imageOrientationCache.set(imageUrl, false);
        setIsLandscape(false);
      }
    );

    return () => {
      active = false;
    };
  }, [imageUrl]);

  const foregroundStyle = useMemo(
    () => [styles.imageForeground, isLandscape ? styles.imageForegroundLandscape : styles.imageForegroundPortrait],
    [isLandscape]
  );

  return (
    <View style={styles.imageLayer}>
      <Image source={{ uri: imageUrl }} style={styles.imageBackground} resizeMode="cover" blurRadius={14} />
      <Image source={{ uri: imageUrl }} style={foregroundStyle} resizeMode="contain" />
    </View>
  );
}

export function HomeEventosRail({ items, onPressEvent }: HomeEventosRailProps) {
  const router = useRouter();
  const { t } = useI18n();
  const listRef = useRef<FlatList<HomeEventoCard>>(null);
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
    const startIndex = segmentSize > 1 ? middleStartIndex : 0;
    currentIndexRef.current = startIndex;
    listRef.current?.scrollToOffset({ offset: startIndex * EVENT_CARD_STEP, animated: false });
  }, [middleStartIndex, segmentSize]);

  useEffect(() => {
    if (segmentSize <= 1) return;
    const lastLoopIndex = Math.max(loopItems.length - 1, 0);

    const timerId = setInterval(() => {
      const nextIndex = Math.min(currentIndexRef.current + 1, lastLoopIndex);
      currentIndexRef.current = nextIndex;
      listRef.current?.scrollToOffset({ offset: nextIndex * EVENT_CARD_STEP, animated: true });
    }, AUTO_SCROLL_MS);

    return () => clearInterval(timerId);
  }, [loopItems.length, segmentSize]);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const rawOffset = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(rawOffset / EVENT_CARD_STEP);
    const clampedIndex = Math.min(Math.max(nextIndex, 0), Math.max(loopItems.length - 1, 0));
    const recenteredIndex = recenterIndex(clampedIndex);
    currentIndexRef.current = recenteredIndex;

    if (recenteredIndex !== clampedIndex) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: recenteredIndex * EVENT_CARD_STEP, animated: false });
      });
    }
  }

  if (!items.length) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>{t('home.emptyEvents')}</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        ref={listRef}
        horizontal
        data={loopItems}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        showsHorizontalScrollIndicator={false}
        snapToInterval={EVENT_CARD_STEP}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={styles.track}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onMomentumScrollEnd={handleMomentumEnd}
        getItemLayout={(_, index) => ({
          index,
          length: EVENT_CARD_STEP,
          offset: EVENT_CARD_STEP * index,
        })}
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({ offset: EVENT_CARD_STEP * index, animated: false });
        }}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={40}
        windowSize={4}
        removeClippedSubviews
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, shadows.card]}
            onPress={() => {
              if (onPressEvent) {
                onPressEvent(item);
                return;
              }
              router.push('/eventos');
            }}
          >
            <EventImageCard imageUrl={item.imageUrl} />
          </Pressable>
        )}
      />

      <View style={styles.ctaWrap}>
        <Pressable style={[styles.ctaButton, shadows.card]} onPress={() => router.push('/eventos')}>
          <Text style={styles.ctaText}>{t('home.moreEvents')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    paddingHorizontal: spacing.lg,
  },
  separator: {
    width: EVENT_CARD_GAP,
  },
  card: {
    width: EVENT_CARD_WIDTH,
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  imageLayer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBackground: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.1 }],
  },
  imageForeground: {
    zIndex: 1,
  },
  imageForegroundPortrait: {
    width: '100%',
    height: '100%',
  },
  imageForegroundLandscape: {
    width: '100%',
    height: '84%',
  },
  emptyWrap: {
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  ctaWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  ctaButton: {
    backgroundColor: '#023047',
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: fonts.light,
  },
});
