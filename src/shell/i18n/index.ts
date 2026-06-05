import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

const resources = {
  en: { translation: en as Record<string, unknown> },
  zh: { translation: zh as Record<string, unknown> },
};

const detectedLanguage =
  typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en';

// Eager + synchronous init — resources are statically bundled. The kit's
// auth page calls useTranslation() at render time and must find resources
// already loaded.
i18n.use(initReactI18next).init({
  resources,
  lng: detectedLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  initImmediate: false,
});

export { i18n };
