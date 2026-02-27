import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { HomeCategoryItem } from '../../features/home/types';
import { useI18n } from '../../i18n/provider';
import { borderRadius, fonts, spacing } from '../../theme/tokens';

type HomeCategoriesGridProps = {
  items: HomeCategoryItem[];
};

const INITIAL_VISIBLE_COUNT = 6;

export function HomeCategoriesGrid({ items }: HomeCategoriesGridProps) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => {
    if (showAll) return items;
    return items.slice(0, INITIAL_VISIBLE_COUNT);
  }, [items, showAll]);

  const canToggle = items.length > INITIAL_VISIBLE_COUNT;
  const resolveLabel = (item: HomeCategoryItem) => item.labels[lang] || item.labels.es || item.fallbackLabel;

  return (
    <View style={styles.wrapper}>
      <View style={styles.grid}>
        {visible.map((item) => (
          <Pressable
            key={String(item.id)}
            style={styles.item}
            onPress={() => {
              router.push('/comercios');
            }}
          >
            <View style={styles.imageCircleWrap}>
              <Image source={{ uri: item.imageUrl }} style={styles.imageCircle} resizeMode="cover" />
            </View>
            <Text style={styles.label}>{resolveLabel(item)}</Text>
          </Pressable>
        ))}
      </View>

      {canToggle ? (
        <Pressable onPress={() => setShowAll((current) => !current)}>
          <Text style={styles.linkText}>
            {showAll ? t('home.toggleLessCategories') : t('home.toggleAllCategories')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.lg,
  },
  item: {
    width: '31%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  imageCircleWrap: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#dbeafe',
  },
  imageCircle: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: 16,
    lineHeight: 19,
    textAlign: 'center',
    color: '#374151',
    fontFamily: fonts.regular,
  },
  linkText: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
});
