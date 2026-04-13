import { Anton_400Regular } from '@expo-google-fonts/anton';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Caveat_400Regular } from '@expo-google-fonts/caveat';
import { CormorantGaramond_400Regular } from '@expo-google-fonts/cormorant-garamond';
import { DancingScript_400Regular } from '@expo-google-fonts/dancing-script';
import { FjallaOne_400Regular } from '@expo-google-fonts/fjalla-one';
import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { Kanit_300Light, Kanit_400Regular, Kanit_500Medium, Kanit_600SemiBold, Kanit_700Bold } from '@expo-google-fonts/kanit';
import { LibreBaskerville_400Regular } from '@expo-google-fonts/libre-baskerville';
import { Merriweather_400Regular } from '@expo-google-fonts/merriweather';
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat';
import { Mulish_400Regular } from '@expo-google-fonts/mulish';
import { Nunito_400Regular } from '@expo-google-fonts/nunito';
import { OpenSans_400Regular } from '@expo-google-fonts/open-sans';
import { Oswald_400Regular } from '@expo-google-fonts/oswald';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display';
import { Poppins_400Regular } from '@expo-google-fonts/poppins';
import { Roboto_400Regular } from '@expo-google-fonts/roboto';
import { SourceSansPro_400Regular } from '@expo-google-fonts/source-sans-pro';
import { WorkSans_400Regular } from '@expo-google-fonts/work-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore in dev reloads
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Kanit_300Light,
    Kanit_400Regular,
    Kanit_500Medium,
    Kanit_600SemiBold,
    Kanit_700Bold,
    Poppins_400Regular,
    Inter_400Regular,
    Montserrat_400Regular,
    Roboto_400Regular,
    Nunito_400Regular,
    Mulish_400Regular,
    SourceSansPro_400Regular,
    OpenSans_400Regular,
    WorkSans_400Regular,
    PlayfairDisplay_400Regular,
    Merriweather_400Regular,
    LibreBaskerville_400Regular,
    CormorantGaramond_400Regular,
    DancingScript_400Regular,
    Pacifico_400Regular,
    Caveat_400Regular,
    GreatVibes_400Regular,
    BebasNeue_400Regular,
    Oswald_400Regular,
    Anton_400Regular,
    FjallaOne_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="pedidos" options={{ headerShown: false }} />
        <Stack.Screen name="estadisticas" options={{ headerShown: false }} />
        <Stack.Screen name="admin-menu" options={{ headerShown: false }} />
        <Stack.Screen name="perfil/index" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
