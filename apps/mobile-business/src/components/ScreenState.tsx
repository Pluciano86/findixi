import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { fonts, spacing } from '../theme/tokens';

type ScreenStateProps = {
  loading?: boolean;
  message: string;
};

export function ScreenState({ loading = false, message }: ScreenStateProps) {
  return (
    <View style={styles.wrap}>
      {loading ? <ActivityIndicator size="small" color="#2563eb" /> : null}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  message: {
    fontFamily: fonts.medium,
    color: '#475569',
    textAlign: 'center',
    fontSize: 15,
  },
});
