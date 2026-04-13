import { resolverPlanComercio } from '@findixi/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BusinessChrome } from '../src/components/BusinessChrome';
import { ScreenState } from '../src/components/ScreenState';
import { getSessionOrReset } from '../src/lib/auth-session';
import { fetchBusinessAnalyticsDashboard } from '../src/lib/business-analytics';
import { fetchBusinessAccessByUser, type BusinessAccess, type BusinessProfile } from '../src/lib/business-profile';
import { supabase } from '../src/lib/supabase';
import { borderRadius, fonts, shadows, spacing } from '../src/theme/tokens';

type DashboardUser = {
  fullName: string;
  email: string;
  roleLabel: string;
  avatarUrl: string;
};

type CommerceDashboardCard = {
  idComercio: number;
  profile: BusinessProfile;
  logoUrl: string;
  favoriteCount: number;
  viewsProfile30Days: number;
};

const AVATAR_FALLBACK = 'https://placehold.co/120x120?text=User';
const STORAGE_PUBLIC_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';

function isMissingResourceError(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  return code === '42P01' || code === '42703' || message.includes('does not exist') || message.includes('relation') || message.includes('column');
}

function resolvePublicImage(pathOrUrl: string): string {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${STORAGE_PUBLIC_BASE}${raw}`;
}

function roleLabelFromAccess(access: BusinessAccess | null): string {
  const raw = String(access?.primaryRole || '').toLowerCase();
  if (raw.includes('owner')) return 'DUEÑO';
  if (raw.includes('admin')) return 'ADMIN COMERCIO';
  if (raw.includes('editor')) return 'EDITOR COMERCIO';
  return 'USUARIO COMERCIO';
}

async function fetchDashboardUser(userId: string, fallbackEmail: string, roleLabel: string): Promise<DashboardUser> {
  const base: DashboardUser = {
    fullName: 'Usuario comercio',
    email: fallbackEmail,
    roleLabel,
    avatarUrl: AVATAR_FALLBACK,
  };

  const { data, error } = await supabase.from('usuarios').select('nombre,apellido,email,imagen').eq('id', userId).maybeSingle();
  if (error) return base;
  if (!data) return base;

  const raw = data as Record<string, unknown>;
  const fullName = `${String(raw.nombre || '').trim()} ${String(raw.apellido || '').trim()}`.trim() || base.fullName;
  const email = String(raw.email || '').trim() || base.email;
  const avatar = resolvePublicImage(String(raw.imagen || '').trim()) || base.avatarUrl;

  return {
    fullName,
    email,
    roleLabel,
    avatarUrl: avatar,
  };
}

async function fetchCommerceLogoUrl(idComercio: number): Promise<string> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) return '';

  const attempts = [
    { column: 'idComercio', logoColumn: 'logo' },
    { column: 'idcomercio', logoColumn: 'logo' },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('imagenesComercios')
      .select(`imagen,${attempt.logoColumn}`)
      .eq(attempt.column, idComercio)
      .eq(attempt.logoColumn, true)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingResourceError(error)) continue;
      return '';
    }

    const imageName = String((data as Record<string, unknown> | null)?.imagen || '').trim();
    if (!imageName) continue;
    return resolvePublicImage(imageName);
  }

  return '';
}

async function fetchFavoriteCount(idComercio: number): Promise<number> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) return 0;

  const attempts = ['idcomercio', 'idComercio'];
  for (const column of attempts) {
    const { count, error } = await supabase.from('favoritosusuarios').select(column, { count: 'exact', head: true }).eq(column, idComercio);

    if (error) {
      if (isMissingResourceError(error)) continue;
      return 0;
    }

    return Number(count || 0);
  }

  return 0;
}

export default function BusinessDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [userCard, setUserCard] = useState<DashboardUser | null>(null);
  const [commerceCards, setCommerceCards] = useState<CommerceDashboardCard[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const session = await getSessionOrReset();
      if (!session?.user) {
        setAssignmentCount(0);
        setUserCard(null);
        setCommerceCards([]);
        router.replace('/login');
        return;
      }

      const access = await fetchBusinessAccessByUser(session.user.id);
      const roleLabel = roleLabelFromAccess(access);
      const commerceEntries = access.comercios;
      const [user, cards] = await Promise.all([
        fetchDashboardUser(session.user.id, String(session.user.email || ''), roleLabel),
        Promise.all(
          commerceEntries.map(async (entry) => {
            const [logoUrl, favoriteCount, dashboardData] = await Promise.all([
              fetchCommerceLogoUrl(entry.idComercio),
              fetchFavoriteCount(entry.idComercio),
              fetchBusinessAnalyticsDashboard(entry.idComercio, 30),
            ]);
            return {
              idComercio: entry.idComercio,
              profile: entry.profile,
              logoUrl,
              favoriteCount,
              viewsProfile30Days: dashboardData.kpis.viewsProfile,
            } satisfies CommerceDashboardCard;
          })
        ),
      ]);

      setUserCard(user);
      setAssignmentCount(access.assignmentCount);
      setCommerceCards(cards);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar el dashboard de negocio.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      return undefined;
    }, [loadData])
  );

  const preTitle = userCard ? (
    <View style={[styles.userCard, shadows.card]}>
      <Image source={{ uri: userCard.avatarUrl || AVATAR_FALLBACK }} style={styles.userAvatar} />
      <View style={styles.userInfo}>
        <Text style={styles.userRole}>{userCard.roleLabel}</Text>
        <Text style={styles.userName}>{userCard.fullName}</Text>
        <Text style={styles.userEmail}>{userCard.email}</Text>
      </View>
      <Pressable
        style={styles.logoutBtn}
        onPress={() => {
          void supabase.auth.signOut({ scope: 'local' });
          router.replace('/login');
        }}
      >
        <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <BusinessChrome title="Mis Comercios" preTitle={preTitle}>
      {loading ? <ScreenState loading message="Cargando datos del comercio..." /> : null}

      {!loading && error ? <ScreenState message={error} /> : null}

      {!loading && !error && commerceCards.length === 0 ? (
        <View style={[styles.card, shadows.card]}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Asignación</Text>
          </View>
          <Text style={styles.cardTitle}>Cuenta activa sin comercio vinculado</Text>
          <Text style={styles.cardBody}>
            Esta cuenta inició sesión, pero no encontramos un comercio disponible para mostrar.
            {assignmentCount > 0 ? ` (${assignmentCount} asignación(es) detectada(s))` : ''}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => void loadData()}>
            <Text style={styles.primaryBtnText}>Reintentar carga</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              void supabase.auth.signOut({ scope: 'local' });
              router.replace('/login');
            }}
          >
            <Text style={styles.secondaryBtnText}>Cambiar cuenta</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && commerceCards.length > 0 ? (
        <ScrollView contentContainerStyle={styles.scrollWrap}>
          {commerceCards.map((commerce) => {
            const planInfo = resolverPlanComercio(commerce.profile as unknown as Record<string, unknown>);
            return (
              <Pressable
                key={`commerce-${commerce.idComercio}`}
                style={[styles.commerceCard, shadows.card]}
                onPress={() => router.push(`/perfil?idComercio=${commerce.idComercio}` as never)}
              >
                <View style={styles.commerceTop}>
                  <View style={styles.logoWrap}>
                    {commerce.logoUrl ? (
                      <Image source={{ uri: commerce.logoUrl }} style={styles.commerceLogo} />
                    ) : (
                      <View style={[styles.commerceLogo, styles.logoPlaceholder]}>
                        <Text style={styles.logoPlaceholderText}>Logo</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.commerceMeta}>
                    <Text style={styles.commerceName}>{commerce.profile.nombre || 'Comercio sin nombre'}</Text>
                    <Text style={styles.commercePlan}>{planInfo?.nombre || commerce.profile.plan_nombre || 'Sin plan'}</Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={[styles.statBox, styles.statBoxPrimary]}>
                    <Text style={styles.statLabel}>Favoritos</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValueCenter}>{commerce.favoriteCount}</Text>
                    </View>
                    <Text style={styles.statSuffix}>Usuarios</Text>
                  </View>
                  <View style={[styles.statBox, styles.statBoxSecondary]}>
                    <Text style={styles.statLabel}>Ultimos 30 Dias</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValueCenter}>{commerce.viewsProfile30Days}</Text>
                    </View>
                    <Text style={styles.statSuffix}>Visitas</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </BusinessChrome>
  );
}

const styles = StyleSheet.create({
  userCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userRole: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  userName: {
    fontFamily: fonts.bold,
    fontSize: 21,
    color: '#0f172a',
  },
  userEmail: {
    fontFamily: fonts.light,
    fontSize: 12,
    color: '#334155',
  },
  logoutBtn: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#b91c1c',
  },
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
  badge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#334155',
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: '#0f172a',
  },
  cardBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#475569',
  },
  primaryBtn: {
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
  commerceCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: spacing.lg,
    gap: spacing.md,
  },
  commerceTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  logoWrap: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commerceLogo: {
    width: 66,
    height: 66,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  logoPlaceholderText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#64748b',
  },
  commerceMeta: {
    flex: 1,
    gap: 4,
  },
  commerceName: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: '#0f172a',
  },
  commercePlan: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    fontFamily: fonts.semibold,
    fontSize: 13,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxPrimary: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  statBoxSecondary: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  statLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  statValueRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueCenter: {
    fontFamily: fonts.bold,
    fontSize: 40,
    color: '#0f172a',
    textAlign: 'center',
  },
  statSuffix: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
});
