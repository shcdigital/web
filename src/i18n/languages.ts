/**
 * Language definitions for SHC Digital i18n
 * Used for routing, hreflang, flag display, and locale metadata
 */

export interface Language {
  code: string;
  name: string;
  flag: string;
  locale: string;
  dir: 'ltr' | 'rtl';
}

export const languages: Record<string, Language> = {
  es: {
    code: 'es',
    name: 'Español',
    flag: '🇦🇷',
    locale: 'es_AR',
    dir: 'ltr',
  },
  pt: {
    code: 'pt',
    name: 'Português',
    flag: '🇧🇷',
    locale: 'pt_BR',
    dir: 'ltr',
  },
  en: {
    code: 'en',
    name: 'English',
    flag: '🇺🇸',
    locale: 'en_US',
    dir: 'ltr',
  },
} as const;

export type LanguageCode = keyof typeof languages;

export const defaultLanguage: LanguageCode = 'es';

export const languageCodes: LanguageCode[] = ['es', 'pt', 'en'];

export function isValidLanguage(code: string): code is LanguageCode {
  return code in languages;
}

export function getLanguage(code: string): Language {
  if (!isValidLanguage(code)) {
    return languages[defaultLanguage];
  }
  return languages[code as LanguageCode];
}

/**
 * Get the language code from an Astro request URL
 * Expects URLs like /es/, /pt/, /en/
 */
export function getLanguageFromUrl(url: URL): LanguageCode {
  const segments = url.pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  return isValidLanguage(firstSegment) ? firstSegment : defaultLanguage;
}

/**
 * Generate a localized URL path
 * e.g., localizeUrl('/servicios', 'pt') → '/pt/servicios'
 */
export function localizePath(path: string, lang: LanguageCode): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/${lang}${cleanPath}`;
}

/**
 * Generate alternate/hreflang URLs for all languages
 */
export function getAlternateUrls(basePath: string, currentLang: LanguageCode): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const lang of languageCodes) {
    alternates[languages[lang].locale] = localizePath(basePath, lang);
  }
  // x-default points to default language
  alternates['x-default'] = localizePath(basePath, defaultLanguage);
  return alternates;
}