import { formatearTelefonoDisplay, resolverPlanComercio } from '@findixi/shared';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { BusinessChrome } from '../../src/components/BusinessChrome';
import { ScreenState } from '../../src/components/ScreenState';
import { fetchBusinessProfileByUser, type BusinessProfile } from '../../src/lib/business-profile';
import { supabase } from '../../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../../src/theme/tokens';

export default function BusinessProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        setLoading(true);
        setError('');
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session?.user) {
            if (active) setProfile(null);
            return;
          }

          const data = await fetchBusinessProfileByUser(session.user.id);
          if (active) setProfile(data);
        } catch (loadError) {
          if (!active) return;
          const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar el perfil del comercio.';
          setError(message);
        } finally {
          if (active) setLoading(false);
        }
      };

      void run();

      return () => {
        active = false;
      };
    }, [])
  );

  const plan = useMemo(() => (profile ? resolverPlanComercio(profile as unknown as Record<string, unknown>) : null), [profile]);

  return (
    <BusinessChrome title="Perfil del comercio">
      {loading ? <ScreenState loading message="Cargando perfil..." /> : null}

      {!loading && error ? <ScreenState message={error} /> : null}

      {!loading && !error && !profile ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.title}>No hay un comercio vinculado a esta cuenta.</Text>
          <Pressable style={styles.button} onPress={() => router.replace('/login')}>
            <Text style={styles.buttonText}>Ir a login</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && profile ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.title}>{profile.nombre || 'Comercio sin nombre'}</Text>
          <Text style={styles.line}>Plan: {plan?.nombre || profile.plan_nombre || 'No definido'}</Text>
          <Text style={styles.line}>Teléfono: {formatearTelefonoDisplay(profile.telefono || '') || 'No disponible'}</Text>
          <Text style={styles.line}>Dirección: {profile.direccion || 'No disponible'}</Text>
          <Text style={styles.line}>Municipio: {profile.municipio || 'No disponible'}</Text>
          <Text style={styles.line}>Última actualización: {profile.updated_at || 'No disponible'}</Text>
        </View>
      ) : null}
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
  line: {
    color: '#334155',
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  button: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  buttonText: {
    color: '#0f172a',
    fontFamily: fonts.medium,
    fontSize: 15,
  },
});
