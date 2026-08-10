/**
 * i18n translation utility for Astro
 * Provides type-safe t() function with nested key support
 */

import type { LanguageCode } from './languages.js';

// Translation keys type - will be inferred from JSON files
export type TranslationKeys = Record<string, string | Record<string, unknown>>;

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
    const module = await import(`./${lang}.json`);
    translationsCache[lang] = module.default as TranslationKeys;
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
 * Get all translations for a namespace
 * Usage: t.ns('hero') → { title: '...', subtitle: '...', ... }
 */
export function tNs(namespace: string, lang?: LanguageCode): Record<string, string> {
  const targetLang = lang ?? currentLang;
  const translations = translationsCache[targetLang] ?? translationsCache.es;
  const ns = translations[namespace];

  if (ns && typeof ns === 'object') {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(ns)) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
    return result;
  }
  return {};
}

// Default language constant for internal use
const defaultLanguage: LanguageCode = 'es';