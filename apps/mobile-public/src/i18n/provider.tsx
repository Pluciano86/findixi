import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { authStorage } from '../lib/storage';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_OPTIONS,
  getLanguageOption,
  isLanguageCode,
  type LanguageCode,
  type LanguageOption,
} from './languages';
import { translate, type I18nKey } from './translations';

const LANGUAGE_STORAGE_KEY = 'findixi.mobile-public.lang';

type I18nContextValue = {
  lang: LanguageCode;
  currentLanguage: LanguageOption;
  languages: readonly LanguageOption[];
  ready: boolean;
  t: (key: I18nKey) => string;
  setLang: (lang: LanguageCode) => Promise<void>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: ReactNode;
};

function syncDocumentLanguage(lang: LanguageCode): void {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;

  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-lang', lang);
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [lang, setLangState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadLanguagePreference() {
      const stored = (await authStorage.getItem(LANGUAGE_STORAGE_KEY))?.toLowerCase() ?? '';
      const initialLang = isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;

      if (!active) return;
      setLangState(initialLang);
      syncDocumentLanguage(initialLang);
      setReady(true);
    }

    void loadLanguagePreference();

    return () => {
      active = false;
    };
  }, []);

  const setLang = useCallback(async (nextLang: LanguageCode) => {
    setLangState(nextLang);
    syncDocumentLanguage(nextLang);
    await authStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
  }, []);

  const t = useCallback(
    (key: I18nKey) => {
      return translate(lang, key);
    },
    [lang]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      currentLanguage: getLanguageOption(lang),
      languages: LANGUAGE_OPTIONS,
      ready,
      t,
      setLang,
    }),
    [lang, ready, setLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('[mobile-public] useI18n must be used within I18nProvider');
  }
  return context;
}
