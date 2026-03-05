import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';

import { useI18n } from '../../i18n/provider';
import { borderRadius, fonts, spacing } from '../../theme/tokens';
import { getLegalContent, getLegalEmail } from '../../features/legal/content';

type LegalDocumentType = 'privacy' | 'terms';

type LegalDocumentViewProps = {
  doc: LegalDocumentType;
  contentPaddingStyle: ViewStyle;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
};

export function LegalDocumentView({ doc, contentPaddingStyle, onScroll, scrollEventThrottle }: LegalDocumentViewProps) {
  const { lang } = useI18n();
  const legalByLang = useMemo(() => getLegalContent(lang), [lang]);
  const legal = doc === 'privacy' ? legalByLang.privacy : legalByLang.terms;
  const email = getLegalEmail();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentPaddingStyle]}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
    >
      <View style={styles.headerCard}>
        <Text style={styles.title}>{legal.title}</Text>
        <Text style={styles.updated}>{legal.updated}</Text>
      </View>

      <Text style={styles.intro}>{legal.intro}</Text>

      {legal.sections.map((section) => (
        <View key={`${doc}-${section.title}`} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{section.title}</Text>

          {(section.paragraphs || []).map((paragraph, index) => (
            <Text key={`${section.title}-p-${index}`} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}

          {(section.bullets || []).map((bullet, index) => (
            <Text key={`${section.title}-b-${index}`} style={styles.bullet}>
              • {bullet}
            </Text>
          ))}

          {section.emailLine ? (
            <Text style={styles.paragraph}>
              {section.emailLine}{' '}
              <Text style={styles.email} onPress={() => void Linking.openURL(`mailto:${email}`)}>
                {email}
              </Text>
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    minHeight: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: '#f8fafc',
  },
  headerCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  title: {
    color: '#1f2937',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  updated: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  intro: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  sectionCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.medium,
  },
  paragraph: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  bullet: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    paddingLeft: spacing.xs,
  },
  email: {
    color: '#2563eb',
    fontFamily: fonts.medium,
  },
});
