import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../../i18n/provider';
import { fonts, spacing } from '../../theme/tokens';

type HomeLoadingBlockProps = {
  text?: string;
};

export function HomeLoadingBlock({ text }: HomeLoadingBlockProps) {
  const { t } = useI18n();
  const label = text || t('home.loadingContent');

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="small" color="#0284c7" />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
});
