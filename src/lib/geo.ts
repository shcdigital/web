// src/lib/geo.ts
// Geolocalización por IP (client-side). El sitio es 100% estático, así que
// la detección se hace desde el navegador contra una API pública sin key.
// El proveedor es intercambiable: editar GEO_PROVIDERS sin tocar el mapeo.

type Lang = "es" | "pt" | "en";

interface GeoProvider {
  name: string;
  url: string;
  // Extrae el código ISO-3166 alpha-2 del país desde cualquier respuesta JSON.
  parse: (data: Record<string, unknown>) => string | null;
}

export const GEO_PROVIDERS: GeoProvider[] = [
  {
    name: "countries.dev",
    url: "https://countries.dev/ip",
    parse: (d) => {
      const c = (d.country as Record<string, unknown> | undefined) ?? {};
      const raw = (c.code ?? d.country_code ?? d.country) as unknown;
      return typeof raw === "string" ? raw.slice(0, 2).toUpperCase() : null;
    },
  },
  {
    name: "ipchu",
    url: "https://ipchu.com/api/ip",
    parse: (d) => {
      const raw = d.country;
      return typeof raw === "string" ? raw.slice(0, 2).toUpperCase() : null;
    },
  },
];

// Países que quieren cada idioma. El resto del mundo no redirige
// ni cambia la bandera: se queda con el idioma actual.
const LANG_BY_COUNTRY: Record<string, Lang> = {
  // Español, cada uno con su propia bandera
  AR: "es", BO: "es", CL: "es", CO: "es", CR: "es", CU: "es", DO: "es",
  EC: "es", ES: "es", GQ: "es", GT: "es", HN: "es", MX: "es", NI: "es",
  PA: "es", PE: "es", PR: "es", PY: "es", SV: "es", UY: "es", VE: "es",
  // Portugués
  AO: "pt", BR: "pt", CV: "pt", MZ: "pt", PT: "pt",
  // Inglés
  AU: "en", CA: "en", GB: "en", IE: "en", IN: "en", NZ: "en", US: "en", ZA: "en",
};

export const langForCountry = (cc: string): Lang | null => LANG_BY_COUNTRY[cc] ?? null;

const GEO_KEY = "shc_geo";
const PICK_KEY = "shc_langpick";
const GEO_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export const hasManualPick = (): boolean => {
  try { return localStorage.getItem(PICK_KEY) !== null; } catch { return false; }
};

export const markManualPick = (lang: string): void => {
  try { localStorage.setItem(PICK_KEY, lang); } catch { /* storage bloqueado */ }
};

export const getCachedCountry = (): string | null => {
  try {
    const raw = localStorage.getItem(GEO_KEY);
    if (!raw) return null;
    const { cc, ts } = JSON.parse(raw) as { cc?: string; ts?: number };
    if (!cc || !ts || Date.now() - ts > GEO_TTL_MS) return null;
    return cc;
  } catch { return null; }
};

export const cacheCountry = (cc: string): void => {
  try { localStorage.setItem(GEO_KEY, JSON.stringify({ cc, ts: Date.now() })); } catch { /* noop */ }
};

export async function detectCountry(timeoutMs = 6000): Promise<string | null> {
  if (typeof window === "undefined" || typeof fetch !== "function") return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (const provider of GEO_PROVIDERS) {
      try {
        const res = await fetch(provider.url, { signal: controller.signal });
        if (!res.ok) continue;
        const cc = provider.parse(await res.json());
        if (cc) return cc;
      } catch {
        // Proveedor caído o bloqueado por red → seguir con el siguiente.
        continue;
      }
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}