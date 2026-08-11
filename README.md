# SHC Digital — Sitio Web

Sitio estático de [SHC Digital](https://shcdigital.net.ar), empresa de diseño web con IA. Construido con **Astro** y publicado en **GitHub Pages** con dominio propio.

## 🌍 Soporte Multilingüe

El sitio cuenta con soporte completo para **español (🇦🇷)**, **portugués (🇧🇷)** e **inglés (🇺🇸)**:

- **Selección de idioma**: selector con banderas en la barra de navegación
- **Ruteo SEO-amigable**: URLs en formato `/es/`, `/pt/`, `/en/`; las rutas raíz (`/servicios`, `/planes`, etc.) redirigen al idioma por defecto
- **Detección de idioma por IP**: en el primer ingreso se consulta una API pública de geolocalización (sin key, con fallback entre proveedores) y se redirige según el país; la elección manual queda persistida y tiene prioridad
- **Sistema de traducciones**: archivos JSON con lookup type-safe mediante `t()`, `tHtml()` y `tNs()`, con fallback a español
- **Optimización SEO**: hreflang automático, Open Graph localizado, canonical URLs
- **Persistencia**: idioma elegido y país detectado guardados en `localStorage` (30 días)

## Stack

- **Astro 7** — build estático, cero JS por defecto.
- **Sistema i18n completo** — traducciones en `src/i18n/` con JSON por idioma.
- **Detección de país** — `src/lib/geo.ts` con proveedores intercambiables y mapeo país → idioma.
- **Design system propio** — tokens semánticos de marca en `brand/tokens.json` que generan `src/styles/brand.css` (fuente única de la marca SHC).
- **GitHub Actions** — pipeline de build + deploy en `.github/workflows/deploy.yml`.

## Estructura

```
brand/                  tokens de marca (fuente única → brand.css)
scripts/sync-brand.mjs  genera brand.css y sincroniza el :root del Worker clientes
src/
  components/
    ui/                 Navbar, Footer, Hero, GhostTitle, ContactForm
    LanguageSwitcher/   selector de idioma con banderas (usa lib/geo.ts)
  layouts/Layout.astro  layout base (SEO, CSP, nav/footer, hreflang)
  lib/geo.ts            detección de idioma por IP (client-side, sin key)
  i18n/
    languages.ts        definiciones de idioma (código, bandera, locale)
    index.ts            utilidades de traducción (t(), tHtml(), tNs())
    es.json, pt.json, en.json  traducciones completas
  pages/                rutas raíz → redirigen al idioma por defecto
    index, servicios, planes, terminos, github-pages, briefing
  pages/[lang]/         rutas localizadas (es, pt, en): index, servicios,
                        planes/[plan], terminos, github-pages, briefing
  styles/               global.css, pages.css, brand.css, briefing.css
  scripts/              app.js, briefing.js, utils.js
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
- **`/github-pages/`** — guía de despliegue de sitios estáticos en GitHub Pages (multilingüe).

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

## Funcionalidades

- ✅ Soporte trilingüe completo (español argentino, portugués brasileño, inglés estadounidense)
- ✅ Selector de idioma con banderas de Argentina 🇦🇷, Brasil 🇧🇷 y Estados Unidos 🇺🇸
- ✅ Detección de idioma por IP en el primer ingreso, con redirección según el país y elección manual persistida
- ✅ Ruteo dinámico por idioma: `/es/servicios`, `/pt/servicios`, `/en/servicios`
- ✅ Redirección automática de las rutas raíz (`/`, `/servicios`, `/planes`, `/terminos`, `/briefing`) al idioma por defecto
- ✅ Sistema de traducciones type-safe con fallback a español
- ✅ hreflang automático para SEO multilingüe
- ✅ Open Graph y Twitter Cards localizados por idioma
- ✅ Páginas de planes por idioma (`/es/planes/starter`, `/pro`, `/business`) con tablas de inclusión tipo tabla
- ✅ Página de briefing multilingüe con envío a `briefing-api`
- ✅ Formularios y componentes adaptados a cada idioma