import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { backgroundGray, spacing } from '../src/theme/tokens';

export default function EventosScreen() {
  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentPaddingStyle]}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          <Text style={styles.title}>Eventos</Text>
          <Text style={styles.subtitle}>Modulo en construccion para la paridad inicial del home web-style.</Text>
        </ScrollView>
      )}
    </PublicAppChrome>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: backgroundGray,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl + spacing.md,
    gap: spacing.sm,
    minHeight: '100%',
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
