import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';

import { backgroundGray, borderRadius, fonts, primaryBlue, primaryOrange, spacing } from '../theme/tokens';
import { supabase } from '../lib/supabase';

type BusinessChromeProps = {
  title: string;
  preTitle?: ReactNode;
  footerItems?: FooterItem[];
  children: ReactNode;
};

export type FooterItem = {
  key: string;
  label: string;
  onPress: () => void;
  active?: boolean;
};

const navItems = [
  { label: 'Dashboard', route: '/' as const },
  { label: 'Pedidos', route: '/pedidos' as const },
  { label: 'Perfil', route: '/perfil' as const },
];
const BUSINESS_LOGO_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/FindixiBusiness.png';

export function BusinessChrome({ title, preTitle, footerItems, children }: BusinessChromeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const rootNavState = useRootNavigationState();

  const activePath = useMemo(() => {
    if (pathname.startsWith('/perfil')) return '/perfil';
    return pathname;
  }, [pathname]);

  const canGoBack = Boolean(
    (typeof (router as { canGoBack?: () => boolean }).canGoBack === 'function' &&
      (router as { canGoBack: () => boolean }).canGoBack()) ||
      (rootNavState?.key && Number(rootNavState.index || 0) > 0)
  );

  const resolvedFooterItems = useMemo<FooterItem[]>(() => {
    if (Array.isArray(footerItems) && footerItems.length > 0) return footerItems;
    return navItems.map((item) => ({
      key: item.route,
      label: item.label,
      onPress: () => {
        if (activePath === item.route) return;
        router.push(item.route);
      },
      active: activePath === item.route,
    }));
  }, [activePath, footerItems, router]);

  const compactFooter = resolvedFooterItems.length > 3;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          {canGoBack ? (
            <Pressable style={styles.headerSideBtnLeft} onPress={() => router.back()}>
              <Text style={styles.headerBackIcon}>←</Text>
            </Pressable>
          ) : null}

          <Image source={{ uri: BUSINESS_LOGO_URL }} resizeMode="contain" style={styles.headerLogo} />

          <Pressable
            style={styles.headerSideBtnRight}
            onPress={() => {
              void supabase.auth.signOut({ scope: 'local' }).finally(() => {
                router.replace('/login');
              });
            }}
          >
            <Text style={styles.headerLogoutText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        {preTitle}
        <Text style={styles.screenTitle}>{title}</Text>
        {children}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
        <View style={[styles.footer, compactFooter ? styles.footerWrap : null]}>
          {resolvedFooterItems.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.navButton,
                compactFooter ? styles.navButtonCompact : styles.navButtonDefault,
                item.active ? styles.navButtonPressedIn : styles.navButtonRaised,
                item.active ? styles.navButtonActive : null,
                pressed ? styles.navButtonPressed : null,
              ]}
              onPress={item.onPress}
            >
              <Text style={[styles.navLabel, item.active ? styles.navLabelActive : null]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: backgroundGray,
  },
  headerSafeArea: {
    backgroundColor: primaryBlue,
  },
  header: {
    backgroundColor: primaryBlue,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 74,
    position: 'relative',
  },
  headerLogo: {
    width: 210,
    height: 54,
  },
  headerSideBtnLeft: {
    position: 'absolute',
    left: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  headerSideBtnRight: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 88,
  },
  headerBackIcon: {
    color: '#ffffff',
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 24,
  },
  headerLogoutText: {
    color: '#ffffff',
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  footerSafeArea: {
    backgroundColor: primaryBlue,
  },
  screenTitle: {
    color: '#0f172a',
    fontFamily: fonts.bold,
    fontSize: 24,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: primaryBlue,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  footerWrap: {
    flexWrap: 'wrap',
  },
  navButton: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  navButtonDefault: {
    flex: 1,
  },
  navButtonCompact: {
    width: '31%',
    minHeight: 42,
  },
  navButtonRaised: {
    borderTopColor: 'rgba(255,255,255,0.55)',
    borderLeftColor: 'rgba(255,255,255,0.55)',
    borderBottomColor: 'rgba(2,6,23,0.45)',
    borderRightColor: 'rgba(2,6,23,0.45)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  navButtonPressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  navButtonActive: {
    borderColor: primaryOrange,
    backgroundColor: primaryOrange,
    shadowOpacity: 0,
    elevation: 0,
  },
  navButtonPressedIn: {
    borderTopColor: '#b45309',
    borderLeftColor: '#b45309',
    borderBottomColor: '#fdba74',
    borderRightColor: '#fdba74',
    transform: [{ translateY: 1 }],
  },
  navLabel: {
    color: '#e2e8f0',
    fontFamily: fonts.light,
    fontSize: 15,
  },
  navLabelActive: {
    color: '#fff',
    fontFamily: fonts.regular,
  },
});
