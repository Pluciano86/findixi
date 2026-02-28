import { DEFAULT_APP_BASE_URLS } from '@findixi/shared';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../i18n/provider';
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
    route: '/comercios',
  },
  {
    labelKey: 'footer.events',
    iconUri: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoEventos.png',
    route: '/eventos',
  },
  {
    labelKey: 'footer.profile',
    iconUri: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png',
    route: '/cuenta',
  },
];

function isRouteActive(pathname: string, route: string): boolean {
  if (pathname === route) return true;
  if (route === '/comercios' && (pathname.startsWith('/comercio/') || pathname === '/playas')) return true;
  return false;
}

export function FooterWebStyle() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const privacyUrl = `${DEFAULT_APP_BASE_URLS.public}/privacy-policy.html`;
  const termsUrl = `${DEFAULT_APP_BASE_URLS.public}/terms-of-service.html`;

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.row}>
        {footerItems.map((item) => {
          const active = isRouteActive(pathname, String(item.route));
          return (
            <Pressable key={String(item.route)} style={styles.item} onPress={() => router.push(item.route)}>
              <Image
                source={{ uri: item.iconUri }}
                style={[styles.icon, active ? styles.iconActive : null]}
                resizeMode="contain"
              />
              <Text style={[styles.label, active ? styles.labelActive : null]}>{t(item.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legalRow}>
        <Pressable onPress={() => void Linking.openURL(privacyUrl)}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Pressable>
        <Text style={styles.dot}>•</Text>
        <Pressable onPress={() => void Linking.openURL(termsUrl)}>
          <Text style={styles.legalLink}>Terms of Service</Text>
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
  label: {
    color: '#f8fafc',
    fontSize: 11,
    fontFamily: fonts.light,
    textAlign: 'center',
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
