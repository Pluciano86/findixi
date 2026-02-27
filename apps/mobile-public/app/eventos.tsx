import { StyleSheet, Text, View } from 'react-native';

import { FooterWebStyle } from '../src/components/home/FooterWebStyle';
import { HeaderWebStyle } from '../src/components/home/HeaderWebStyle';
import { backgroundGray, spacing } from '../src/theme/tokens';

export default function EventosScreen() {
  return (
    <View style={styles.screenRoot}>
      <View style={styles.deviceFrame}>
        <HeaderWebStyle />
        <View style={styles.content}>
          <Text style={styles.title}>Eventos</Text>
          <Text style={styles.subtitle}>Modulo en construccion para la paridad inicial del home web-style.</Text>
        </View>
        <FooterWebStyle />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  deviceFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    backgroundColor: backgroundGray,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
});
