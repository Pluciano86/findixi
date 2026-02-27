import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { HomeAreaCard } from '../../features/home/types';
import { useI18n } from '../../i18n/provider';
import { borderRadius, fonts, shadows, spacing } from '../../theme/tokens';

type HomeAreasGridProps = {
  items: HomeAreaCard[];
};

export function HomeAreasGrid({ items }: HomeAreasGridProps) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const resolveLabel = (item: HomeAreaCard) => item.labels[lang] || item.labels.es || item.fallbackLabel;
  const isMetro = (slug: string) => slug.trim().toLowerCase() === 'metro';

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={String(item.idArea)}
          style={[styles.card, shadows.card]}
          onPress={() => router.push('/comercios')}
        >
          <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
          <View style={styles.overlay}>
            <Text style={styles.label}>{resolveLabel(item)}</Text>
            {isMetro(item.slug) ? <Text style={styles.subtitle}>{t('home.metroSubtitle')}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  card: {
    width: '48.2%',
    aspectRatio: 2 / 3,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#cbd5e1',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(2,6,23,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  label: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 36,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: spacing.xs,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
});
