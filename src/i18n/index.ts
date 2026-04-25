import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { env } from '@/config/env';
import en from './locales/en.json';
import es from './locales/es.json';
import uk from './locales/uk.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, es: { translation: es }, uk: { translation: uk } },
    fallbackLng: env.defaultLocale,
    supportedLngs: env.supportedLocales,
    interpolation: { escapeValue: false },
    detection: {
      order: ['cookie', 'localStorage', 'navigator'],
      caches: ['cookie', 'localStorage'],
    },
  });

export default i18n;
