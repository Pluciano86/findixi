import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { HomeBannerItem } from '../../features/home/types';
import { useI18n } from '../../i18n/provider';
import { borderRadius, fonts, shadows, spacing } from '../../theme/tokens';

type HomeCarouselProps = {
  items: HomeBannerItem[];
};

const AUTO_ROTATE_MS = 8000;

export function HomeCarousel({ items }: HomeCarouselProps) {
  const router = useRouter();
  const { t } = useI18n();
  const initialIndex = useMemo(() => {
    if (items.length <= 1) return 0;
    return Math.floor(Math.random() * items.length);
  }, [items.length]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timerId = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, AUTO_ROTATE_MS);

    return () => clearInterval(timerId);
  }, [items.length]);

  function resolveExternalUrl(url: string): string {
    const clean = url.trim();
    if (/^https?:\/\//i.test(clean)) return clean;
    return `https://${clean}`;
  }

  if (!items.length) {
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyCard, shadows.card]}>
          <Text style={styles.emptyText}>{t('home.noBanners')}</Text>
        </View>
      </View>
    );
  }

  const currentBanner = items[currentIndex] ?? items[0];

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.slide, shadows.card]}
        onPress={() => {
          if (currentBanner.idComercio) {
            router.push({ pathname: '/comercio/[id]', params: { id: String(currentBanner.idComercio) } });
            return;
          }

          if (currentBanner.externalUrl) {
            const target = resolveExternalUrl(currentBanner.externalUrl);
            void Linking.openURL(target);
          }
        }}
      >
        <Image source={{ uri: currentBanner.imageUrl }} style={styles.image} resizeMode="cover" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  slide: {
    width: '100%',
    aspectRatio: 8 / 3,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emptyWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  emptyCard: {
    height: 110,
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
});
