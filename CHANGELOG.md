# Changelog

Todas las versiones notables de SHC Digital.

## [0.1.0] - 2026-08-08

### Added
- Sitio reconstruido sobre **Astro 7** (antes HTML estático): componentes,
  layout base con SEO/Open Graph/Twitter, build estático optimizado.
- Sistema de tokens semánticos de marca en `brand/tokens.json` con script de
  sincronización (`npm run sync:brand`) que además aplica la misma identidad
  al login del Worker SSO de clientes (`clientes.shcdigital.net.ar`).
- Página **`/briefing/`** — formulario de briefing para clientes, standalone,
  con barra de progreso y envío al worker `briefing-api`.
- Página **`/nomenclador/`** — documento interno de cotización (noindex, no
  enlazado).
- Menú de navegación móvil (no existía en el sitio original).
- Pipeline de deploy con GitHub Actions (`.github/workflows/deploy.yml`).
- `robots.txt` y `sitemap.xml` actualizados a las rutas nuevas (sin `.html`).

### Changed
- Rutas públicas migradas de `.html` a limpias (`/servicios/`, `/terminos/`,
  `/github-pages/`, `/briefing/`, `/nomenclador/`).
- CSS y JS del sitio movidos a archivos externos para respetar la CSP estricta
  (`script-src 'self'`, `style-src 'self'`).

### Removed
- HTML estáticos originales de la raíz del repo (`index.html`, `servicios.html`,
  `terminos.html`, `github-pages.html`, `briefing.html`, `nomenclador.html`).

### Fixed
- Config de contenido migrada a `src/content.config.ts` (requerido por Astro 6+).

---
**Rollback:** la versión anterior está preservada en el tag `pre-astro`.
