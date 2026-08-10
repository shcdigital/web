# SHC Digital — Sitio Web

Sitio estático de [SHC Digital](https://shcdigital.net.ar), empresa de diseño web con IA. Construido con **Astro** y publicado en **GitHub Pages** con dominio propio.

## �� 🌍 Soporte Multilingüe

Nueva versión con soporte completo para **español (���🇦���🇷)**, **portugués (���🇧���🇷)** e **inglés (���🇺���🇸)**:

- **Selección de idioma**: Selector con banderas en la barra de navegación
- **Ruteo SEO-amigable**: URLs en formato `/es/`, `/pt/`, `/en/` con redirección raíz a `/es/`
- **Sistema de traducción**: Archivos JSON con lookup type-safe mediante función `t()`
- **Optimización SEO**: hreflang automático, Open Graph localizado, canonical URLs
- **Persistencia**: Selección de idioma guardada en `localStorage`

## Stack

- **Astro 7** — build estático, cero JS por defecto.
- **Sistema i18n completo** — Traducciones en `src/i18n/` con JSON por idioma
- **Design system propio** — tokens semánticos de marca en `brand/tokens.json` que generan `src/styles/brand.css` (fuente única de la marca SHC).
- **GitHub Actions** — pipeline de build + deploy en `.github/workflows/deploy.yml`.

## Estructura

```
brand/                  tokens de marca (fuente única → brand.css)
scripts/sync-brand.mjs  genera brand.css y sincroniza el :root del Worker clientes
src/
  styles/               global.css, pages.css + CSS de páginas aisladas
  components/ui/        Navbar, Footer, Hero, ContactForm, LanguageSwitcher
  layouts/Layout.astro  layout base (SEO, CSP, nav/footer, hreflang)
  i18n/                 Sistema de internacionalización
    languages.ts        Definiciones de idioma (código, nombre, bandera, locale)
    index.ts            Utilidades de traducción (t(), tHtml(), tNs())
    es.json, pt.json, en.json  Traducciones completas
  pages/                index, servicios, terminos, github-pages,
                        briefing, nomenclador (aisladas)
  pages/[lang]/         Rutas dinámicas por idioma (es, pt, en)
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

- **`/briefing/`** — formulario de briefing para clientes. Página standalone con su propio CSS/JS y envío al worker `briefing-api`.
- **`/nomenclador/`** — documento interno de cotización (noindex, no enlazado).

## SSO de clientes (`clientes/`)

Worker de Cloudflare que sirve **clientes.shcdigital.net.ar**: login con Google (única autoridad de autenticación) y redirect a los paneles de los clientes con un JWT firmado. Detalle completo en [`clientes/README.md`](clientes/README.md).

Aspectos destacados:

- **Google OAuth** con authorization code + PKCE y acceso por email (`GOOGLE_ADMIN_EMAILS` global, `TENANTS[].emails` por panel). Ambos son **secrets de Cloudflare** (`wrangler secret put`), no van en el repo, y el HTML servido al cliente no expone los emails (solo `id` + `name` de cada panel).
- **Sin `1101`**: las excepciones se loguean y responden un 500 limpio; los `fetch` a Google están blindados. `Response.redirect()` tiene headers inmutables, por eso los `302` con cookie se construyen a mano.
- `/auth/logout` responde a GET (redirige a `/`) y POST (JSON).
- **Login local solo en dev** (`ENABLE_LOCAL_LOGIN`): en producción responde `404` y el HTML servido no contiene ninguna referencia a autenticación local.
- Botón "Continuar con Google" con el logo oficial de Google (SVG 4 colores).

## Marca sincronizada

La marca se mantiene en `brand/tokens.json`. `npm run sync:brand` regenera `src/styles/brand.css` y aplica el mismo `:root` en el Worker de `clientes/`, para que el login (`clientes.shcdigital.net.ar`) comparta la identidad del sitio.

## Despliegue

1. Push a `main` dispara el workflow `Deploy to GitHub Pages`.
2. Requiere que en **GitHub → Settings → Pages** la fuente sea **GitHub Actions** y que el dominio custom `shcdigital.net.ar` (CNAME) esté configurado.
3. El `CNAME` vive en `public/` y se publica junto con el sitio.

## Novedades en v0.4.0

- � ✅ Soporte trilingüe completo (español argentino, portugués brasileño, inglés estadounidense)
- � ✅ Selector de idioma con banderas de Argentina �� 🇦���🇷, Brasil �� 🇧���🇷 y Estados Unidos �� 🇺���🇸
- � ✅ Ruteo dinámico por idioma: `/es/servicios`, `/pt/servicios`, `/en/servicios`
- � ✅ Redirección automática de `/` → `/es/`
- � ✅ Sistema de traducciones type-safe con fallback a español
- � ✅ hreflang automático para SEO multilingüe
- � ✅ Open Graph y Twitter Cards localizados por idioma
- � ✅ Todas las páginas traducidas: inicio, servicios, proceso, planes, testimonios, por qué, briefing CTA, contacto, términos, GitHub Pages
- � ✅ Formularios y componentes adaptados a cada idioma