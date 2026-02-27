import { useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../i18n/provider';
import { fonts, primaryOrange, spacing } from '../../theme/tokens';

export function HeaderWebStyle() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { currentLanguage, languages, setLang, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const showBack = pathname !== '/';

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.sideSlot}>
          {showBack ? (
            <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.backBtnPlaceholder} />
          )}
        </View>

        <View style={styles.centerLogoWrap}>
          <Image
            source={{
              uri: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoBlanco.png',
            }}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.sideSlot}>
          <Pressable
            style={styles.langBtn}
            onPress={() => setMenuOpen((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={t('header.changeLanguage')}
          >
            <Text style={styles.langGlobe}>🌐</Text>
            <Text style={styles.langFlag}>{currentLanguage.flag}</Text>
            <Text style={styles.langCaret}>▾</Text>
          </Pressable>
        </View>
      </View>

      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.langMenu, { top: insets.top + 54, right: spacing.md }]}>
            {languages.map((item) => (
              <Pressable
                key={item.code}
                style={styles.langMenuItem}
                onPress={() => {
                  void setLang(item.code);
                  setMenuOpen(false);
                }}
              >
                <Text style={styles.langMenuFlag}>{item.flag}</Text>
                <Text style={styles.langMenuLabel}>{item.native}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: primaryOrange,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    position: 'relative',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  sideSlot: {
    width: 74,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  centerLogoWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 136,
    height: 36,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 34,
    height: 34,
  },
  backIcon: {
    color: '#ffffff',
    fontSize: 29,
    lineHeight: 30,
    fontFamily: fonts.medium,
  },
  langBtn: {
    minWidth: 58,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  langGlobe: {
    fontSize: 15,
    lineHeight: 19,
  },
  langFlag: {
    fontSize: 18,
    lineHeight: 22,
  },
  langCaret: {
    fontSize: 11,
    color: '#231F20',
    marginTop: 1,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.15)',
  },
  langMenu: {
    position: 'absolute',
    minWidth: 130,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    overflow: 'hidden',
  },
  langMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  langMenuFlag: {
    fontSize: 18,
  },
  langMenuLabel: {
    color: '#231F20',
    fontSize: 14,
    fontFamily: fonts.regular,
  },
});
