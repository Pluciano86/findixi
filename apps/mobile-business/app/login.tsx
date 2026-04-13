import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchBusinessAccessByUser } from '../src/lib/business-profile';
import { supabase } from '../src/lib/supabase';
import { borderRadius, fonts, primaryBlue, primaryOrange, spacing } from '../src/theme/tokens';

const LOGO_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/FindixiBusiness.png';

function mapLoginError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Correo o contraseña inválidos.';
  if (normalized.includes('email not confirmed')) return 'Debes confirmar tu correo antes de iniciar sesión.';
  return message;
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const isDisabled = useMemo(() => {
    return loading || !email.trim() || !password.trim();
  }, [email, loading, password]);

  const onSubmit = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      Alert.alert('Faltan datos', 'Completa email y contraseña.');
      return;
    }

    setErrorText('');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        setErrorText(mapLoginError(error.message || 'No se pudo iniciar sesión.'));
        return;
      }

      const authUserId = data?.user?.id;
      if (!authUserId) {
        setErrorText('No se pudo validar la sesión. Intenta nuevamente.');
        return;
      }

      const access = await fetchBusinessAccessByUser(authUserId);
      if (access.assignmentCount === 0) {
        await supabase.auth.signOut({ scope: 'local' });
        setErrorText('Esta cuenta no tiene comercios asignados. Usa la cuenta autorizada de comercio.');
        return;
      }

      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setErrorText(mapLoginError(message));
    } finally {
      setLoading(false);
    }
  }, [email, password, router]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardWrap}>
        <View style={styles.content}>
          <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />

          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.tag}>Panel Comercio</Text>
              <Text style={styles.title}>Inicia sesión</Text>
              <Text style={styles.subtitle}>Acceso para dueños y colaboradores asignados.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="usuario@comercio.com"
                placeholderTextColor="#bfdbfe"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#bfdbfe"
                  style={styles.passwordInput}
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.passwordToggle}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Text style={styles.passwordToggleText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
                </Pressable>
              </View>
            </View>

            {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

            <Pressable style={[styles.button, isDisabled ? styles.buttonDisabled : null]} disabled={isDisabled} onPress={() => void onSubmit()}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
            </Pressable>

            <Pressable onPress={() => router.replace('/')}>
              <Text style={styles.secondary}>Volver al dashboard</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: primaryBlue,
  },
  keyboardWrap: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  logo: {
    width: '100%',
    height: 58,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: {
    gap: 6,
  },
  tag: {
    color: '#bfdbfe',
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 30,
  },
  subtitle: {
    color: '#e2e8f0',
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    color: '#e2e8f0',
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  passwordWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#fff',
  },
  passwordToggle: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  passwordToggleText: {
    color: '#dbeafe',
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  button: {
    backgroundColor: primaryOrange,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  error: {
    color: '#fecaca',
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  secondary: {
    marginTop: 2,
    color: '#dbeafe',
    fontFamily: fonts.medium,
    textAlign: 'center',
    fontSize: 14,
  },
});
