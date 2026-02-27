import { StyleSheet, Text } from 'react-native';

import { fonts, spacing } from '../../theme/tokens';

type HomeSectionTitleProps = {
  title: string;
};

export function HomeSectionTitle({ title }: HomeSectionTitleProps) {
  return <Text style={styles.title}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: {
    textAlign: 'center',
    fontSize: 26,
    fontFamily: fonts.medium,
    color: '#111827',
    marginBottom: spacing.md,
  },
});
