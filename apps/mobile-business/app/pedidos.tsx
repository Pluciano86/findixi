import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BusinessChrome } from '../src/components/BusinessChrome';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

export default function BusinessPedidosScreen() {
  const router = useRouter();

  return (
    <BusinessChrome title="Pedidos">
      <View style={[styles.card, shadows.card]}>
        <Text style={styles.title}>Pedidos (Fase 3.1)</Text>
        <Text style={styles.body}>
          Esta pantalla ya está preparada dentro del app de negocio. En el siguiente bloque conectamos la data real de órdenes
          del comercio autenticado.
        </Text>

        <Pressable style={styles.button} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>Volver al dashboard</Text>
        </Pressable>
      </View>
    </BusinessChrome>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  body: {
    color: '#475569',
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  button: {
    marginTop: spacing.sm,
    minHeight: 42,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  buttonText: {
    color: '#0f172a',
    fontFamily: fonts.medium,
    fontSize: 15,
  },
});
