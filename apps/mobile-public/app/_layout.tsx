import { Kanit_300Light, Kanit_400Regular, Kanit_500Medium, Kanit_600SemiBold, Kanit_700Bold } from '@expo-google-fonts/kanit';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nProvider } from '../src/i18n/provider';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash screen is already hidden in dev reloads.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Kanit_300Light,
    Kanit_400Regular,
    Kanit_500Medium,
    Kanit_600SemiBold,
    Kanit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StatusBar style="dark" />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="comercios" options={{ headerShown: false }} />
          <Stack.Screen name="eventos" options={{ headerShown: false }} />
          <Stack.Screen name="cuenta" options={{ headerShown: false }} />
          <Stack.Screen name="comercio/[id]" options={{ headerShown: false }} />
        </Stack>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
