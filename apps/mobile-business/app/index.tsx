import { DEFAULT_APP_BASE_URLS, formatearMonedaUSD, formatearTelefonoDisplay, resolverPlanComercio } from '@findixi/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BusinessChrome } from '../src/components/BusinessChrome';
import { ScreenState } from '../src/components/ScreenState';
import { fetchBusinessProfileByUser, type BusinessProfile } from '../src/lib/business-profile';
import { supabase } from '../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

export default function BusinessDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setProfile(null);
        return;
      }

      const data = await fetchBusinessProfileByUser(session.user.id);
      setProfile(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar el dashboard de negocio.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      return undefined;
    }, [loadData])
  );

  const planInfo = useMemo(() => {
    if (!profile) return null;
    return resolverPlanComercio(profile as unknown as Record<string, unknown>);
  }, [profile]);

  return (
    <BusinessChrome title="Dashboard">
      {loading ? <ScreenState loading message="Cargando datos del comercio..." /> : null}

      {!loading && error ? <ScreenState message={error} /> : null}

      {!loading && !error && !profile ? (
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>No hay sesión activa</Text>
          <Text style={styles.cardBody}>Inicia sesión con la cuenta del comercio para gestionar su información.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/login')}>
            <Text style={styles.primaryBtnText}>Ir a Login</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && profile ? (
        <ScrollView contentContainerStyle={styles.scrollWrap}>
          <View style={[styles.card, shadows.card]}>
            <Text style={styles.cardTitle}>{profile.nombre || 'Comercio sin nombre'}</Text>
            <Text style={styles.metaText}>Teléfono: {formatearTelefonoDisplay(profile.telefono || '') || 'No disponible'}</Text>
            <Text style={styles.metaText}>Dirección: {profile.direccion || 'No disponible'}</Text>
            <Text style={styles.metaText}>Municipio: {profile.municipio || 'No disponible'}</Text>
            <Text style={styles.metaText}>Plan: {planInfo?.nombre || profile.plan_nombre || 'Sin plan'}</Text>
            <Text style={styles.metaText}>Mensualidad ref.: {formatearMonedaUSD(planInfo?.precio ?? 0)}</Text>
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={styles.cardTitle}>Acciones rápidas</Text>
            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/perfil')}>
              <Text style={styles.secondaryBtnText}>Perfil del comercio</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => router.push('/pedidos')}>
              <Text style={styles.secondaryBtnText}>Pedidos</Text>
            </Pressable>
            <Text style={styles.helperText}>Portal web: {DEFAULT_APP_BASE_URLS.comercio}</Text>
          </View>

          <Pressable
            style={styles.logoutBtn}
            onPress={() => {
              void supabase.auth.signOut();
              router.replace('/login');
            }}
          >
            <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </BusinessChrome>
  );
}

const styles = StyleSheet.create({
  scrollWrap: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    color: '#0f172a',
  },
  cardBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#475569',
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#334155',
  },
  helperText: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    color: '#64748b',
    fontSize: 13,
  },
  primaryBtn: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#EC7F25',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  secondaryBtn: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    color: '#0f172a',
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  logoutBtn: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#ef4444',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: '#fff5f5',
  },
  logoutBtnText: {
    color: '#b91c1c',
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
