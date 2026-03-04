import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../src/lib/supabase';
import { borderRadius, fonts, primaryBlue, primaryOrange, spacing } from '../src/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      Alert.alert('Faltan datos', 'Completa email y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        Alert.alert('No se pudo iniciar sesión', error.message);
        return;
      }
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      Alert.alert('No se pudo iniciar sesión', message);
    } finally {
      setLoading(false);
    }
  }, [email, password, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Findixi Business</Text>
        <Text style={styles.subtitle}>Acceso para comercios</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Contraseña"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />

        <Pressable style={styles.button} disabled={loading} onPress={() => void onSubmit()}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </Pressable>

        <Pressable onPress={() => router.replace('/')}>
          <Text style={styles.secondary}>Volver al dashboard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: primaryBlue,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: primaryOrange,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  secondary: {
    marginTop: spacing.sm,
    color: primaryBlue,
    fontFamily: fonts.medium,
    textAlign: 'center',
    fontSize: 14,
  },
});
