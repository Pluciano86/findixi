export type LanguageCode = 'es' | 'en' | 'zh' | 'fr' | 'pt' | 'de' | 'it' | 'ko' | 'ja';

export type LanguageOption = {
  code: LanguageCode;
  short: string;
  native: string;
  flag: string;
};

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'es', short: 'ES', native: 'ES', flag: '🇵🇷' },
  { code: 'en', short: 'EN', native: 'EN', flag: '🇺🇸' },
  { code: 'zh', short: 'ZH', native: '中文', flag: '🇨🇳' },
  { code: 'fr', short: 'FR', native: 'FR', flag: '🇫🇷' },
  { code: 'pt', short: 'PT', native: 'PT', flag: '🇧🇷' },
  { code: 'de', short: 'DE', native: 'DE', flag: '🇩🇪' },
  { code: 'it', short: 'IT', native: 'IT', flag: '🇮🇹' },
  { code: 'ko', short: 'KO', native: '한국어', flag: '🇰🇷' },
  { code: 'ja', short: 'JA', native: '日本語', flag: '🇯🇵' },
] as const;

export const DEFAULT_LANGUAGE: LanguageCode = 'es';

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGE_OPTIONS.some((item) => item.code === value);
}

export function getLanguageOption(code: LanguageCode): LanguageOption {
  return LANGUAGE_OPTIONS.find((item) => item.code === code) ?? LANGUAGE_OPTIONS[0];
}
