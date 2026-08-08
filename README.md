# SHC Digital — Sitio Web

Sitio estático de [SHC Digital](https://shcdigital.net.ar), empresa de diseño
web con IA. Construido con **Astro** y publicado en **GitHub Pages** con
dominio propio.

## Stack

- **Astro 7** — build estático, cero JS por defecto.
- **Design system propio** — tokens semánticos de marca en `brand/tokens.json`
  que generan `src/styles/brand.css` (fuente única de la marca SHC).
- **GitHub Actions** — pipeline de build + deploy en `.github/workflows/deploy.yml`.

## Estructura

```
brand/                  tokens de marca (fuente única → brand.css)
scripts/sync-brand.mjs  genera brand.css y sincroniza el :root del Worker clientes
src/
  styles/               global.css, pages.css + CSS de páginas aisladas
  components/ui/        Navbar, Footer, Hero, ContactForm
  layouts/Layout.astro  layout base (SEO, CSP, nav/footer)
  pages/                index, servicios, terminos, github-pages,
                        briefing, nomenclador (aisladas)
  scripts/              app.js, briefing.js
  content.config.ts     colecciones (base vacía, YAGNI)
public/                 favicon, logo, robots.txt, sitemap.xml, CNAME
clientes/               Worker SSO (clientes.shcdigital.net.ar) — proyecto anidado
briefing-api/           Worker de briefings (Resend) — proyecto anidado
```

## Comandos

| Comando | Acción |
| --- | --- |
| `npm install` | Instala dependencias |
| `npm run dev` | Dev server en `localhost:4321` |
| `npm run build` | Build estático a `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm run check` | Typecheck + diagnostics de Astro |
| `npm run sync:brand` | Regenera `brand.css` y sincroniza la marca en `clientes` |

## Páginas aisladas

- **`/briefing/`** — formulario de briefing para clientes. Página standalone con
  su propio CSS/JS y envío al worker `briefing-api`.
- **`/nomenclador/`** — documento interno de cotización (noindex, no enlazado).

## Marca sincronizada

La marca se mantiene en `brand/tokens.json`. `npm run sync:brand` regenera
`src/styles/brand.css` y aplica el mismo `:root` en el Worker de `clientes/`,
para que el login (`clientes.shcdigital.net.ar`) comparta la identidad del sitio.

## Despliegue

1. Push a `main` dispara el workflow `Deploy to GitHub Pages`.
2. Requiere que en **GitHub → Settings → Pages** la fuente sea **GitHub Actions**
   y que el dominio custom `shcdigital.net.ar` (CNAME) esté configurado.
3. El `CNAME` vive en `public/` y se publica junto con el sitio.
