import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../../i18n/provider';
import { borderRadius, fonts, shadows, spacing } from '../../theme/tokens';

const URL_LUNCH = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/EspecialLunch.png';
const URL_HH = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/EspecialHH.png';

const ESPECIAL_HORA_INICIO = 120;
const ESPECIAL_HORA_FIN = 930;

function isLunchTime(date = new Date()): boolean {
  const totalMin = date.getHours() * 60 + date.getMinutes();
  return totalMin >= ESPECIAL_HORA_INICIO && totalMin < ESPECIAL_HORA_FIN;
}

export function HomeEspecialesCard() {
  const router = useRouter();
  const { t } = useI18n();
  const isLunch = useMemo(() => isLunchTime(), []);

  return (
    <View style={styles.outerWrap}>
      <Pressable style={[styles.card, shadows.card]} onPress={() => router.push('/especiales')}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: isLunch ? URL_LUNCH : URL_HH }} style={styles.image} resizeMode="contain" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{isLunch ? t('home.specialsLunch') : t('home.specialsHappyHour')}</Text>
          <Text style={styles.subtitle}>{t('home.specialsCta')}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 146,
  },
  imageWrap: {
    width: '42%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '95%',
    height: 96,
  },
  textWrap: {
    width: '55%',
    gap: spacing.sm,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    color: '#dc2626',
    fontFamily: fonts.bold,
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    fontFamily: fonts.medium,
  },
});
