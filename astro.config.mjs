// astro.config.mjs
//
// Sitio estático SHC Digital → GitHub Pages con dominio custom.
// site: URL final real (ver standards/astro.md del AI Workspace)
// base: "/" porque el dominio custom resuelve a la raíz del repositorio.
// build.inlineStylesheets: "never" → CSS externo para mantener la CSP
// estricta del sitio (style-src 'self').

import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://shcdigital.net.ar",
  base: "/",
  build: {
    inlineStylesheets: "never",
  },
  // assetsInlineLimit: 0 → los chunks JS quedan como archivos externos y no
  // se inlinean en el HTML. Requisito de la CSP estricta (script-src 'self').
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
  integrations: [],
});
