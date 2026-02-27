import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../../i18n/provider';
import { borderRadius, shadows, spacing } from '../../theme/tokens';

export function HomeBusinessCta() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <View style={styles.wrap}>
      <Pressable style={[styles.card, shadows.card]} onPress={() => router.push('/cuenta')}>
        <Text style={styles.badge}>{t('home.businessBadge')}</Text>
        <Text style={styles.title}>{t('home.businessTitle')}</Text>
        <Text style={styles.copy}>{t('home.businessCopy')}</Text>
        <Text style={styles.cta}>{t('home.businessCta')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#ecfeff',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  badge: {
    color: '#0e7490',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  copy: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  cta: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
});
