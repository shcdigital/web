# Changelog

Todas las versiones notables de SHC Digital.

## [0.3.1] - 2026-08-09

### Fixed
- **Login de Google funcionando** en el SSO de clientes: `Response.redirect()`
  tiene headers inmutables y no se le podía `append("Set-Cookie", …)`, lo que
  tiraba `TypeError` (1101/500) y nunca completaba la sesión. Ahora el `302` se
  construye con `new Response(null, { headers })`.
- **Nunca más `1101`**: todo el handler de fetch está envuelto en `try/catch`
  que loguea la causa y responde un 500 limpio. Los `fetch` a los endpoints de
  Google quedaron blindados (falla de red → 502 controlado).
- `/auth/logout` ahora responde a **GET** (borra sesión y redirige a `/`); antes
  solo aceptaba POST y un GET directo daba 404.
- **CSP** del SSO: se permite `static.cloudflareinsights.com` (beacon de Cloudflare
  Web Analytics) para eliminar el warning de script bloqueado.

### Changed
- El botón "Continuar con Google" usa el **logo oficial de Google** (SVG 4
  colores) en lugar de la "G" de marca.
- La pantalla muestra "Bienvenido, {nombre}" en lugar de "Sesión: <email>".
- **Login local oculto en producción**: `POST /auth/login-local` responde `404`
  (no `403`) y el HTML servido ya no contiene ninguna referencia a autenticación
  local (form, JS ni textos) cuando `ENABLE_LOCAL_LOGIN=false`.

## [0.3.0] - 2026-08-09

### Added
- **Google OAuth en el SSO de clientes** (`clientes`): login con Google
  (authorization code + PKCE, parámetro `state` anti-CSRF, validación de
  `email_verified`). El acceso se controla por email:
  - `GOOGLE_ADMIN_EMAILS` (vars): correos con acceso global a todos los paneles.
  - `TENANTS[i].emails`: correos permitidos para cada panel.
  - `/auth/sso/<tenantId>` ahora verifica el acceso del email al tenant (403 si
    no corresponde). Configurados: `shcdigitalsolutions@gmail.com` (admin global)
    y `revistaliterariatds@gmail.com` (solo geo-gráficas).
- La pantalla de bienvenida se renderiza en el servidor según la sesión: lista
  solo los paneles permitidos; botón "Continuar con Google".

### Changed
- Login local (`admin/admin123`) queda **solo en dev**, detrás de
  `ENABLE_LOCAL_LOGIN` (en producción `false`).

## [0.2.0] - 2026-08-08

### Security
- **Briefing API** (`briefing-api`): rate-limit por IP en KV (máx. 3 envíos /
  10 min), tope de tamaño del body y validación de origen. Control real contra
  bomba de emails: antes un script podía spamear el formulario ilimitadamente.
- **SSO de clientes** (`clientes`): bloqueo por IP tras 5 intentos fallidos de
  login (anti fuerza bruta, 15 min).
- **Logout por POST**: el logout ahora exige `POST` (anti CSRF de cierre de
  sesión); la cookie es `SameSite=Lax`.
- **CSP en el login** de `clientes.shcdigital.net.ar`.
- Se eliminó la "clave" hardcodeada `ClaveSecretaDeSHCDigital2026` del bundle
  público (no aportaba seguridad; se envía un valor aleatorio por sesión).
- Se agregó `security.txt` (`/.well-known/security.txt`) al dominio principal.

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
