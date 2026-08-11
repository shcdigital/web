/**
 * i18n translation utility for Astro
 * Provides type-safe t() function with nested key support
 */

import type { LanguageCode } from './languages.js';

// Translation value type - recursive JSON tree (strings, numbers, booleans,
// nested objects and arrays), inferred from the JSON files
export type TranslationValue = string | number | boolean | TranslationValue[] | { [key: string]: TranslationValue };
export type TranslationKeys = Record<string, TranslationValue>;

// Type of the Spanish translation file, used to type tNs() results per namespace
// With `with { type: 'json' }`, TS types JSON modules with the JSON keys as
// named exports (no `default`), so the module namespace IS the JSON object.
export type EsTranslations = typeof import('./es.json');

let translationsCache: Record<LanguageCode, TranslationKeys> = {
  es: {},
  pt: {},
  en: {},
};

let currentLang: LanguageCode = 'es';

/**
 * Set the current language (called per-request in Astro)
 */
export function setLanguage(lang: LanguageCode): void {
  currentLang = lang;
}

/**
 * Get the current language
 */
export function getCurrentLanguage(): LanguageCode {
  return currentLang;
}

/**
 * Load translations for a language (called at build time)
 */
export async function loadTranslations(lang: LanguageCode): Promise<TranslationKeys> {
  if (Object.keys(translationsCache[lang]).length > 0) {
    return translationsCache[lang];
  }

  try {
    // Dynamic import with JSON assertion. TS types `.json` modules structurally
    // (default + named exports) which never matches the runtime shape exactly,
    // so pin the shape with an explicit assertion.
    const modules: Record<LanguageCode, () => Promise<{ default?: TranslationKeys }>> = {
      es: () => import('./es.json', { with: { type: 'json' } }) as unknown as Promise<{ default?: TranslationKeys }>,
      pt: () => import('./pt.json', { with: { type: 'json' } }) as unknown as Promise<{ default?: TranslationKeys }>,
      en: () => import('./en.json', { with: { type: 'json' } }) as unknown as Promise<{ default?: TranslationKeys }>,
    };
    const loaded = await modules[lang]();
    translationsCache[lang] = loaded.default ?? (loaded as unknown as TranslationKeys);
    return translationsCache[lang];
  } catch {
    // Fallback to Spanish if translation not found
    if (lang !== 'es') {
      return loadTranslations('es');
    }
    return {};
  }
}

/**
 * Preload all translations (for build-time)
 */
export async function preloadAllTranslations(): Promise<void> {
  await Promise.all(
    (['es', 'pt', 'en'] as LanguageCode[]).map(loadTranslations)
  );
}

/**
 * Get nested value from object using dot notation
 * e.g., getNested(obj, 'hero.title') → obj.hero.title
 */
function getNested(obj: Record<string, unknown>, key: string): string {
  const keys = key.split('.');
  let current: unknown = obj;

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return '';
    }
  }

  return typeof current === 'string' ? current : '';
}

/**
 * Main translation function
 * Usage: t('hero.title') or t('common.button', { fallback: 'Click' })
 */
export function t(key: string, options?: { fallback?: string; lang?: LanguageCode }): string {
  const lang = options?.lang ?? currentLang;
  const translations = translationsCache[lang] ?? translationsCache[defaultLanguage];

  let result = getNested(translations, key);

  // Fallback chain: requested lang → Spanish → provided fallback → key itself
  if (!result && lang !== 'es') {
    result = getNested(translationsCache.es, key);
  }
  if (!result && options?.fallback) {
    result = options.fallback;
  }
  if (!result) {
    result = key; // Last resort: return the key
  }

  return result;
}

/**
 * Translation function with HTML support (for rich text)
 * Usage: t.html('legal.article.1.body.0')
 */
export function tHtml(key: string, options?: { fallback?: string; lang?: LanguageCode }): string {
  return t(key, options);
}

/**
 * Get all translations for a namespace (full JSON tree)
 * Usage: t.ns('hero') → { title: '...', subtitle: '...', items: [...] }
 * Generic T: pass the namespace type for type safety, e.g.
 *   tNs<EsTranslations['hero']>('hero')
 * Without a generic it returns `any` (templates index nested JSON freely).
 */
export function tNs<T = any>(namespace: string, lang?: LanguageCode): T {
  const targetLang = lang ?? currentLang;
  const translations = translationsCache[targetLang] ?? translationsCache.es;
  const ns = translations[namespace];

  if (ns && typeof ns === 'object') {
    return ns as T;
  }
  return {} as T;
}

// Default language constant for internal use
const defaultLanguage: LanguageCode = 'es';