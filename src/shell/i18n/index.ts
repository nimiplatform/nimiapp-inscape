import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_INSCAPE_LOCALE,
  INSCAPE_LOCALES,
  normalizeInscapeLocale,
  type InscapeLocale,
} from '../../domain/locale.ts';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

const resources = {
  en: { translation: en as Record<string, unknown> },
  zh: { translation: zh as Record<string, unknown> },
};

function detectBrowserLocale(): InscapeLocale | null {
  if (typeof navigator === 'undefined') return null;
  const candidates = [
    ...Array.from(navigator.languages || []),
    navigator.language,
  ];
  for (const candidate of candidates) {
    const locale = normalizeInscapeLocale(candidate);
    if (locale) return locale;
  }
  return null;
}

function syncDocumentLanguage(locale: InscapeLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
}

const initialLanguage = detectBrowserLocale() ?? DEFAULT_INSCAPE_LOCALE;

// Eager + synchronous init — resources are statically bundled. The kit's
// auth page calls useTranslation() at render time and must find resources
// already loaded.
i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: DEFAULT_INSCAPE_LOCALE,
  supportedLngs: INSCAPE_LOCALES,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  initImmediate: false,
});

syncDocumentLanguage(initialLanguage);

i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(normalizeInscapeLocale(language) ?? DEFAULT_INSCAPE_LOCALE);
});

export { i18n };
export type { InscapeLocale };
