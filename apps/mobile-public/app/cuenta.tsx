import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenState } from '../src/components/ScreenState';
import { getFavoriteComercioIds, toggleFavoriteComercioId } from '../src/lib/favorites';
import { supabase } from '../src/lib/supabase';

type SessionSnapshot = {
  userId: string;
  email: string;
};

export default function CuentaScreen() {
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [favoritesCount, setFavoritesCount] = useState(0);

  const loadSession = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [{ data: sessionData }, ids] = await Promise.all([
        supabase.auth.getSession(),
        getFavoriteComercioIds(),
      ]);

      const current = sessionData.session?.user;
      if (current) {
        setSession({
          userId: current.id,
          email: current.email ?? '',
        });
      } else {
        setSession(null);
      }

      setFavoritesCount(ids.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cuenta');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSession();
    }, [loadSession])
  );

  const signIn = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('Ingresa correo y password para iniciar sesion.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      await loadSession();
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion');
    } finally {
      setBusy(false);
    }
  }, [email, password, loadSession]);

  const signOut = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      await loadSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar sesion');
    } finally {
      setBusy(false);
    }
  }, [loadSession]);

  const toggleDemoFavorite = useCallback(async () => {
    const ids = await toggleFavoriteComercioId(1);
    setFavoritesCount(ids.length);
  }, []);

  if (loading) return <ScreenState loading message="Cargando cuenta..." />;

  return (
    <View style={styles.screen}>
      {session ? (
        <View style={styles.card}>
          <Text style={styles.title}>Sesion activa</Text>
          <Text style={styles.line}>Email: {session.email || 'sin email'}</Text>
          <Text style={styles.line}>User ID: {session.userId}</Text>
          <Pressable style={styles.button} disabled={busy} onPress={() => void signOut()}>
            <Text style={styles.buttonText}>{busy ? 'Procesando...' : 'Cerrar sesion'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.title}>Login (opcional)</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="correo@ejemplo.com"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="password"
          />
          <Pressable style={styles.button} disabled={busy} onPress={() => void signIn()}>
            <Text style={styles.buttonText}>{busy ? 'Procesando...' : 'Iniciar sesion'}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>Storage adapter</Text>
        <Text style={styles.line}>Favoritos guardados localmente: {favoritesCount}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => void toggleDemoFavorite()}>
          <Text style={styles.secondaryButtonText}>Toggle favorito demo (ID 1)</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
    gap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
  },
  title: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  line: {
    color: '#334155',
    fontSize: 13,
  },
  input: {
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  button: {
    marginTop: 2,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 2,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    fontSize: 12,
  },
});
