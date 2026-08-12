// src/components/LanguageSwitcher/flags.ts
// Banderas inline en SVG (3:2, viewBox 30x20).
//
// Windows/Chrome y Edge NO renderizan banderas emoji (regional indicators) y
// muestran el código ISO ("AR", "BR", "US") en su lugar. SVG inline garantiza
// la misma bandera en todas las plataformas sin dependencias externas ni
// requests extra (compatible con la CSP estricta del sitio; img-src 'self' data:).
//
// Las banderas son simplificadas (sin escudo de armas completo): a 14px de alto
// el detalle no se aprecia y las franjas/colores bastan para identificar cada país.

// Estrella de 5 puntas genérica (puntos decimales acotados).
const star = (cx: number, cy: number, r: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.382;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
};

const AR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Argentina">
  <rect width="30" height="20" fill="#FFFFFF"/>
  <path fill="#74ACDF" d="M0 0h30v6.667H0zM0 13.333h30V20H0z"/>
  <g transform="translate(15 10)">
    <g stroke="#F6B40E" stroke-width="1.2" stroke-linecap="round">
      <line x1="0" y1="-4.4" x2="0" y2="-6.6"/>
      <line x1="0" y1="4.4" x2="0" y2="6.6"/>
      <line x1="-4.4" y1="0" x2="-6.6" y2="0"/>
      <line x1="4.4" y1="0" x2="6.6" y2="0"/>
      <line x1="-3.1" y1="-3.1" x2="-4.7" y2="-4.7"/>
      <line x1="3.1" y1="-3.1" x2="4.7" y2="-4.7"/>
      <line x1="-3.1" y1="3.1" x2="-4.7" y2="4.7"/>
      <line x1="3.1" y1="3.1" x2="4.7" y2="4.7"/>
    </g>
    <circle r="3.2" fill="#F6B40E"/>
    <circle r="1.9" fill="#F6B40E" stroke="#EF8F00" stroke-width="0.6"/>
  </g>
</svg>`;

const BR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Brasil">
  <rect width="30" height="20" fill="#009C3B"/>
  <path d="M15 1.8 28.5 10 15 18.2 1.5 10Z" fill="#FFDF00"/>
  <circle cx="15" cy="10" r="4.6" fill="#002776"/>
  <path d="M10.2 10.4c1.3-1.05 3-1.6 4.8-1.6 1.8 0 3.5.55 4.8 1.6l-.85 1.05c-1.1-.9-2.5-1.35-3.95-1.35-1.45 0-2.85.45-3.95 1.35z" fill="#FFFFFF"/>
</svg>`;

const US_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Estados Unidos">
  <rect width="30" height="20" fill="#FFFFFF"/>
  <g fill="#B22234">
    <rect width="30" height="1.54" y="0"/>
    <rect width="30" height="1.54" y="3.08"/>
    <rect width="30" height="1.54" y="6.16"/>
    <rect width="30" height="1.54" y="9.24"/>
    <rect width="30" height="1.54" y="12.32"/>
    <rect width="30" height="1.54" y="15.4"/>
    <rect width="30" height="1.54" y="18.48"/>
  </g>
  <path fill="#3C3B6E" d="M0 0h12.6v8.62H0z"/>
  <g fill="#FFFFFF">
    <circle cx="1.8" cy="1.5" r="0.6"/>
    <circle cx="5.4" cy="1.5" r="0.6"/>
    <circle cx="9" cy="1.5" r="0.6"/>
    <circle cx="3.6" cy="4.4" r="0.6"/>
    <circle cx="7.2" cy="4.4" r="0.6"/>
    <circle cx="10.8" cy="4.4" r="0.6"/>
    <circle cx="1.8" cy="7.3" r="0.6"/>
    <circle cx="5.4" cy="7.3" r="0.6"/>
    <circle cx="9" cy="7.3" r="0.6"/>
    <circle cx="3.6" cy="1.5" r="0.6"/>
    <circle cx="7.2" cy="1.5" r="0.6"/>
    <circle cx="10.8" cy="1.5" r="0.6"/>
    <circle cx="1.8" cy="4.4" r="0.6"/>
    <circle cx="5.4" cy="4.4" r="0.6"/>
    <circle cx="9" cy="4.4" r="0.6"/>
  </g>
</svg>`;

const ES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="España">
  <rect width="30" height="20" fill="#AA151B"/>
  <rect y="5" width="30" height="10" fill="#F1BF00"/>
  <g transform="translate(4 7.5)">
    <path d="M0 0h6v5a3 3 0 0 1-6 0z" fill="#AA151B"/>
    <path d="M0 0h3v5a3 3 0 0 1-3 0z" fill="#F1BF00"/>
  </g>
</svg>`;

const BO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Bolivia">
  <rect width="30" height="20" fill="#D52B1E"/>
  <rect y="6.67" width="30" height="6.67" fill="#F9E300"/>
  <rect y="13.33" width="30" height="6.67" fill="#007934"/>
</svg>`;

const CL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Chile">
  <rect width="30" height="20" fill="#D52B1E"/>
  <rect width="30" height="10" fill="#FFFFFF"/>
  <rect width="10" height="10" fill="#0037A6"/>
  <path d=${star(5, 5, 2.6)} fill="#FFFFFF"/>
</svg>`;

const CO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Colombia">
  <rect width="30" height="20" fill="#CE1126"/>
  <rect width="30" height="15" fill="#003893"/>
  <rect width="30" height="10" fill="#FCD116"/>
</svg>`;

const CR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Costa Rica">
  <rect width="30" height="20" fill="#002B7F"/>
  <rect y="3" width="30" height="2" fill="#FFFFFF"/>
  <rect y="5" width="30" height="10" fill="#CE1126"/>
  <rect y="15" width="30" height="2" fill="#FFFFFF"/>
</svg>`;

const CU_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Cuba">
  <rect width="30" height="20" fill="#FFFFFF"/>
  <g fill="#002A8F">
    <rect width="30" height="4" y="0"/>
    <rect width="30" height="4" y="8"/>
    <rect width="30" height="4" y="16"/>
  </g>
  <path d="M0 0 L13 10 L0 20 Z" fill="#CF142B"/>
  <path d=${star(5, 10, 2.8)} fill="#FFFFFF"/>
</svg>`;

const DO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="República Dominicana">
  <rect width="30" height="20" fill="#CE1126"/>
  <rect width="15" height="10" fill="#002D62"/>
  <rect x="15" y="10" width="15" height="10" fill="#002D62"/>
  <rect width="30" height="1.8" y="9.1" fill="#FFFFFF"/>
  <rect x="14.1" width="1.8" height="20" fill="#FFFFFF"/>
</svg>`;

const EC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Ecuador">
  <rect width="30" height="20" fill="#CE1126"/>
  <rect width="30" height="15" fill="#003893"/>
  <rect width="30" height="10" fill="#FCD116"/>
  <circle cx="15" cy="12.5" r="2.6" fill="#FCD116"/>
  <circle cx="15" cy="12.5" r="1.5" fill="#003893"/>
</svg>`;

const GT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Guatemala">
  <rect width="30" height="20" fill="#FFFFFF"/>
  <rect width="10" height="20" fill="#4997D0"/>
  <rect x="20" width="10" height="20" fill="#4997D0"/>
</svg>`;

const HN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Honduras">
  <rect width="30" height="20" fill="#0073CF"/>
  <rect y="5" width="30" height="10" fill="#FFFFFF"/>
  <g fill="#0073CF">
    <circle cx="15" cy="10" r="0.9"/>
    <circle cx="15" cy="7.8" r="0.9"/>
    <circle cx="15" cy="12.2" r="0.9"/>
    <circle cx="12.8" cy="10" r="0.9"/>
    <circle cx="17.2" cy="10" r="0.9"/>
  </g>
</svg>`;

const MX_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="México">
  <rect width="30" height="20" fill="#FFFFFF"/>
  <rect width="10" height="20" fill="#006847"/>
  <rect x="20" width="10" height="20" fill="#CE1126"/>
</svg>`;

const NI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Nicaragua">
  <rect width="30" height="20" fill="#0067C6"/>
  <rect y="5" width="30" height="10" fill="#FFFFFF"/>
  <path d="M15 8.4 L18.2 12 H11.8 Z" fill="#0067C6"/>
</svg>`;

const PA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Panamá">
  <rect width="30" height="20" fill="#FFFFFF"/>
  <rect x="15" width="15" height="10" fill="#D21034"/>
  <rect y="10" width="15" height="10" fill="#005293"/>
  <path d=${star(7.5, 5, 2.4)} fill="#005293"/>
  <path d=${star(7.5, 15, 2.4)} fill="#D21034"/>
</svg>`;

const PE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Perú">
  <rect width="30" height="20" fill="#FFFFFF"/>
  <rect width="10" height="20" fill="#D91023"/>
  <rect x="20" width="10" height="20" fill="#D91023"/>
</svg>`;

const PY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Paraguay">
  <rect width="30" height="5" fill="#D52B1E"/>
  <rect y="5" width="30" height="10" fill="#FFFFFF"/>
  <rect y="15" width="30" height="5" fill="#0038A8"/>
</svg>`;

const PR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Puerto Rico">
  <rect width="30" height="20" fill="#FFFFFF"/>
  <g fill="#EE0000">
    <rect width="30" height="4" y="0"/>
    <rect width="30" height="4" y="8"/>
    <rect width="30" height="4" y="16"/>
  </g>
  <path d="M0 0 L13 10 L0 20 Z" fill="#002E5D"/>
  <path d=${star(5, 10, 2.8)} fill="#FFFFFF"/>
</svg>`;

const SV_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="El Salvador">
  <rect width="30" height="20" fill="#0F47AF"/>
  <rect y="5" width="30" height="10" fill="#FFFFFF"/>
  <g transform="translate(15 10)">
    <path d="M0 -3 L2.6 0 H-2.6 Z" fill="#0F47AF"/>
    <rect x="-3" y="0.2" width="6" height="0.8" fill="#0F47AF"/>
  </g>
</svg>`;

const UY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Uruguay">
  <rect width="30" height="20" fill="#FFFFFF"/>
  <g fill="#0038A8">
    <rect width="30" height="2.22" y="2.22"/>
    <rect width="30" height="2.22" y="6.67"/>
    <rect width="30" height="2.22" y="11.11"/>
    <rect width="30" height="2.22" y="15.56"/>
  </g>
  <rect width="13.3" height="20" fill="#FFFFFF"/>
  <g transform="translate(6.65 10)">
    <g stroke="#FCD116" stroke-width="1" stroke-linecap="round">
      <line x1="0" y1="-2.2" x2="0" y2="-3.6"/>
      <line x1="0" y1="2.2" x2="0" y2="3.6"/>
      <line x1="-2.2" y1="0" x2="-3.6" y2="0"/>
      <line x1="2.2" y1="0" x2="3.6" y2="0"/>
      <line x1="-1.55" y1="-1.55" x2="-2.55" y2="-2.55"/>
      <line x1="1.55" y1="-1.55" x2="2.55" y2="-2.55"/>
      <line x1="-1.55" y1="1.55" x2="-2.55" y2="2.55"/>
      <line x1="1.55" y1="1.55" x2="2.55" y2="2.55"/>
    </g>
    <circle r="1.7" fill="#FCD116"/>
  </g>
</svg>`;

const VE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Venezuela">
  <rect width="30" height="20" fill="#CE1126"/>
  <rect width="30" height="15" fill="#00247D"/>
  <rect width="30" height="10" fill="#FFCC00"/>
  <g fill="#FFFFFF">
    <circle cx="11" cy="12" r="0.8"/>
    <circle cx="13.6" cy="11.4" r="0.8"/>
    <circle cx="16.4" cy="11.4" r="0.8"/>
    <circle cx="19" cy="12" r="0.8"/>
    <circle cx="10" cy="13.6" r="0.8"/>
    <circle cx="13" cy="14.3" r="0.8"/>
    <circle cx="17" cy="14.3" r="0.8"/>
    <circle cx="20" cy="13.6" r="0.8"/>
  </g>
</svg>`;

const GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="22" height="14" role="img" aria-label="Idioma">
  <circle cx="15" cy="10" r="8" fill="#74ACDF"/>
  <path d="M7 10c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8-8 3.6-8 8z" fill="#3C8BC6"/>
  <path d="M15 2v16M7 6h16M7 14h16" stroke="#EAF4FF" stroke-width="1" fill="none"/>
</svg>`;

const FLAGS: Record<string, string> = {
  es: AR_SVG,
  pt: BR_SVG,
  en: US_SVG,
};

// Banderas por país para la detección geo. Si el visitante tiene su propio
// flag acá, se muestra la suya; si no, cae a la bandera del idioma detectado.
const COUNTRY_FLAGS: Record<string, string> = {
  AR: AR_SVG,
  BO: BO_SVG,
  BR: BR_SVG,
  CL: CL_SVG,
  CO: CO_SVG,
  CR: CR_SVG,
  CU: CU_SVG,
  DO: DO_SVG,
  EC: EC_SVG,
  ES: ES_SVG,
  GT: GT_SVG,
  HN: HN_SVG,
  MX: MX_SVG,
  NI: NI_SVG,
  PA: PA_SVG,
  PE: PE_SVG,
  PR: PR_SVG,
  PY: PY_SVG,
  SV: SV_SVG,
  UY: UY_SVG,
  US: US_SVG,
  VE: VE_SVG,
};

export const getFlagSvg = (code: string): string => FLAGS[code] ?? GLOBE_SVG;

export const getCountryFlagSvg = (cc: string): string | null =>
  COUNTRY_FLAGS[cc] ?? null;