import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';

import { backgroundGray, borderRadius, fonts, primaryBlue, primaryOrange, spacing } from '../theme/tokens';

type BusinessChromeProps = {
  title: string;
  children: ReactNode;
};

const navItems = [
  { label: 'Dashboard', route: '/' as const },
  { label: 'Pedidos', route: '/pedidos' as const },
  { label: 'Perfil', route: '/perfil' as const },
];

export function BusinessChrome({ title, children }: BusinessChromeProps) {
  const router = useRouter();
  const pathname = usePathname();

  const activePath = useMemo(() => {
    if (pathname.startsWith('/perfil')) return '/perfil';
    return pathname;
  }, [pathname]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Findixi Business</Text>
        <Text style={styles.headerSubtitle}>{title}</Text>
      </View>

      <View style={styles.content}>{children}</View>

      <View style={styles.footer}>
        {navItems.map((item) => {
          const active = activePath === item.route;
          return (
            <Pressable key={item.route} style={styles.navButton} onPress={() => router.replace(item.route)}>
              <Text style={[styles.navLabel, active ? styles.navLabelActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: backgroundGray,
  },
  header: {
    backgroundColor: primaryBlue,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: primaryOrange,
  },
  headerTitle: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  headerSubtitle: {
    color: '#dbeafe',
    fontFamily: fonts.medium,
    fontSize: 14,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  navButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  navLabel: {
    color: '#334155',
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  navLabelActive: {
    color: primaryOrange,
    fontFamily: fonts.bold,
  },
});
