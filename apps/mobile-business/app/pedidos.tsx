import { DEFAULT_APP_BASE_URLS } from '@findixi/shared';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BusinessChrome } from '../src/components/BusinessChrome';
import { borderRadius, fonts, primaryBlue, primaryOrange, shadows, spacing } from '../src/theme/tokens';

const ORDER_STATES = [
  { label: 'Pendientes', value: 'Proximamente' },
  { label: 'En preparacion', value: 'Proximamente' },
  { label: 'Listos para entrega', value: 'Proximamente' },
];

const NEXT_STEPS = [
  'Ver listado de ordenes por comercio.',
  'Cambiar estatus en tiempo real y confirmar recogido.',
  'Historial de pedidos para seguimiento del negocio.',
];

export default function BusinessPedidosScreen() {
  const router = useRouter();

  return (
    <BusinessChrome title="Pedidos">
      <ScrollView contentContainerStyle={styles.scrollWrap}>
        <View style={[styles.heroCard, shadows.card]}>
          <Text style={styles.heroTitle}>Centro de pedidos</Text>
          <Text style={styles.heroCopy}>
            Aqui veras y gestionaras las ordenes del comercio. Esta pantalla queda lista para la integracion completa.
          </Text>
        </View>

        <View style={[styles.card, shadows.card]}>
          <Text style={styles.sectionTitle}>Estado actual</Text>
          {ORDER_STATES.map((item) => (
            <View key={item.label} style={styles.stateRow}>
              <Text style={styles.stateLabel}>{item.label}</Text>
              <Text style={styles.stateValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, shadows.card]}>
          <Text style={styles.sectionTitle}>Que incluira esta pantalla</Text>
          {NEXT_STEPS.map((step) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepDot}>-</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              void Linking.openURL(`${DEFAULT_APP_BASE_URLS.comercio}/ordenesPickup.html`);
            }}
          >
            <Text style={styles.secondaryBtnText}>Abrir ordenes en web</Text>
          </Pressable>
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
          <Text style={styles.primaryBtnText}>Volver al dashboard</Text>
        </Pressable>
      </ScrollView>
    </BusinessChrome>
  );
}

const styles = StyleSheet.create({
  scrollWrap: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: primaryBlue,
    backgroundColor: primaryBlue,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroTitle: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  heroCopy: {
    color: '#dbeafe',
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  stateRow: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  stateLabel: {
    color: '#475569',
    fontFamily: fonts.medium,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  stateValue: {
    color: '#0f172a',
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  stepDot: {
    color: primaryOrange,
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 20,
  },
  stepText: {
    color: '#475569',
    fontFamily: fonts.regular,
    fontSize: 15,
    flex: 1,
  },
  primaryBtn: {
    borderRadius: borderRadius.md,
    minHeight: 42,
    borderWidth: 1,
    borderColor: primaryOrange,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: {
    color: '#9a3412',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: spacing.sm,
    minHeight: 42,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  secondaryBtnText: {
    color: '#1d4ed8',
    fontFamily: fonts.medium,
    fontSize: 15,
  },
});
