import { Linking } from 'react-native';

type OpenExternalUrlOptions = {
  loggerTag?: string;
};

export async function openExternalUrl(urlRaw: string | null | undefined, options?: OpenExternalUrlOptions): Promise<boolean> {
  const url = String(urlRaw ?? '').trim();
  if (!url) return false;

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch (error) {
    const tag = options?.loggerTag || 'mobile-public';
    console.warn(`[${tag}] No se pudo abrir URL externa:`, url, error);
    return false;
  }
}
