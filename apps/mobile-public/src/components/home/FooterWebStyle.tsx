import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../i18n/provider';
import { supabase } from '../../lib/supabase';
import { darkFooter, fonts, spacing } from '../../theme/tokens';

type FooterItem = {
  labelKey: 'footer.home' | 'footer.near' | 'footer.events' | 'footer.profile';
  iconUri: string;
  route: Href;
};

const footerItems: FooterItem[] = [
  {
    labelKey: 'footer.home',
    iconUri: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoHome.png',
    route: '/',
  },
  {
    labelKey: 'footer.near',
    iconUri: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoNearMe.png',
    route: '/cercademi',
  },
  {
    labelKey: 'footer.events',
    iconUri: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoEventos.png',
    route: '/eventos',
  },
  {
    labelKey: 'footer.profile',
    iconUri: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png',
    route: '/usuario',
  },
];

const DEFAULT_PROFILE_ICON = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png';

function isRouteActive(pathname: string, route: string): boolean {
  if (pathname === route) return true;
  if (route === '/usuario' && pathname === '/cuenta') return true;
  if (
    (route === '/comercios' || route === '/cercademi') &&
    (pathname.startsWith('/comercio/') || pathname.startsWith('/playa/') || pathname === '/playas' || pathname === '/comercios')
  ) {
    return true;
  }
  return false;
}

export function FooterWebStyle() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [isAuthed, setIsAuthed] = useState(false);
  const [footerProfileName, setFooterProfileName] = useState('');
  const [footerProfileImage, setFooterProfileImage] = useState(DEFAULT_PROFILE_ICON);
  const profileLabel = useMemo(() => {
    if (isAuthed && footerProfileName.trim()) return footerProfileName.trim();
    return t('footer.profile');
  }, [footerProfileName, isAuthed, t]);

  const loadFooterUser = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        setIsAuthed(false);
        setFooterProfileName('');
        setFooterProfileImage(DEFAULT_PROFILE_ICON);
        return;
      }

      setIsAuthed(true);
      const fallbackName = String(user.email || '').split('@')[0] || '';
      let nextName = fallbackName;
      let nextImage = DEFAULT_PROFILE_ICON;

      const { data: profile } = await supabase.from('usuarios').select('nombre,imagen').eq('id', user.id).maybeSingle();
      const nombre = String((profile as { nombre?: unknown } | null)?.nombre || '').trim();
      const imagen = String((profile as { imagen?: unknown } | null)?.imagen || '').trim();

      if (nombre) nextName = nombre;
      if (imagen) nextImage = imagen;

      setFooterProfileName(nextName);
      setFooterProfileImage(nextImage);
    } catch {
      setIsAuthed(false);
      setFooterProfileName('');
      setFooterProfileImage(DEFAULT_PROFILE_ICON);
    }
  }, []);

  const onFooterItemPress = useCallback(
    (item: FooterItem) => {
      if (item.route === '/usuario' && !isAuthed) {
        router.push({ pathname: '/login', params: { redirect: '/usuario' } });
        return;
      }
      router.push(item.route);
    },
    [isAuthed, router]
  );

  useEffect(() => {
    void loadFooterUser();
    const authListener = supabase.auth.onAuthStateChange(() => {
      void loadFooterUser();
    });

    return () => {
      authListener.data.subscription.unsubscribe();
    };
  }, [loadFooterUser]);

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.row}>
        {footerItems.map((item) => {
          const active = isRouteActive(pathname, String(item.route));
          const isProfileItem = item.route === '/usuario';
          const iconUri = isProfileItem ? footerProfileImage : item.iconUri;
          const label = isProfileItem ? profileLabel : t(item.labelKey);
          return (
            <Pressable key={String(item.route)} style={styles.item} onPress={() => onFooterItemPress(item)}>
              <Image
                source={{ uri: iconUri }}
                style={[
                  styles.icon,
                  active ? styles.iconActive : null,
                  isProfileItem && isAuthed ? styles.profileAvatar : null,
                ]}
                resizeMode={isProfileItem && isAuthed ? 'cover' : 'contain'}
              />
              <Text numberOfLines={1} style={[styles.label, active ? styles.labelActive : null]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legalRow}>
        <Pressable onPress={() => router.push('/privacy-policy')}>
          <Text style={styles.legalLink}>{t('login.privacyPolicy')}</Text>
        </Pressable>
        <Text style={styles.dot}>•</Text>
        <Pressable onPress={() => router.push('/terms-of-service')}>
          <Text style={styles.legalLink}>{t('login.termsOfService')}</Text>
        </Pressable>
        <Text style={styles.dot}>•</Text>
        <Pressable onPress={() => void Linking.openURL('mailto:info@findixi.com')}>
          <Text style={styles.legalLink}>info@findixi.com</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: darkFooter,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    gap: spacing.xs,
  },
  icon: {
    width: 30,
    height: 30,
    opacity: 0.95,
  },
  iconActive: {
    opacity: 1,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
  },
  label: {
    color: '#f8fafc',
    fontSize: 11,
    fontFamily: fonts.light,
    textAlign: 'center',
    maxWidth: '95%',
  },
  labelActive: {
    color: '#f8fafc',
    fontFamily: fonts.medium,
  },
  legalRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.xs,
    rowGap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 11,
    fontFamily: fonts.regular,
  },
  dot: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 12,
    lineHeight: 12,
  },
});
