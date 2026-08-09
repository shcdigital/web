# SHC Digital — SSO de Clientes (`clientes/`)

Worker de Cloudflare que sirve **clientes.shcdigital.net.ar**: la pantalla de
bienvenida y el login del panel de administración de los clientes. Este Worker
es la **única autoridad de login**. Después de autenticar, redirige al panel de
cada cliente (ej. `geo-graficas-admin`) con un **JWT firmado** que el panel
valida para abrir su sesión interna.

## Arquitectura

```
cliente → clientes.shcdigital.net.ar  (Worker SSO — repo web)
             │  welcome + Google OAuth (authorization code + PKCE)
             │  email → autorización por email (admin global + TENANTS.emails)
             ▼
             JWT HS256 (SHARED_JWT_SECRET, TTL 5 min, aud = panel)
             ▼  redirect
       panel del cliente (ej. geo-graficas-admin) /auth/sso
             → valida JWT → sesión KV → cookie → panel
```

## Acceso por email (Google OAuth)

- `GOOGLE_ADMIN_EMAILS` (vars): correos con acceso **global** a todos los paneles.
- `TENANTS[i].emails` (vars): correos con acceso a **ese** panel.
- `/auth/sso/<tenantId>` solo autoriza si el email de la sesión es admin o está
  en los `emails` del tenant. Cualquier otro email queda bloqueado (403).

## Configurar Google OAuth

1. En [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** →
   **OAuth consent screen**: configurá la pantalla de consentimiento (External, tu correo
   como owner, agregá los correos que van a entrar como *Test users* o publicá la app).
2. **Credentials → Create Credentials → OAuth Client ID** → tipo **Web application**.
3. En **Authorized redirect URIs** agregá:
   - Producción: `https://clientes.shcdigital.net.ar/auth/oauth2/google/callback`
   - Dev (opcional): `http://localhost:8787/auth/oauth2/google/callback`
4. Copiá el **Client ID** y el **Client Secret**.

## Deploy

```bash
cd clientes
npm i
npx wrangler kv namespace create SESSIONS        # copiar el <id> al wrangler.toml
npx wrangler secret put SHARED_JWT_SECRET         # MISMO valor en el SSO y en cada panel
npx wrangler secret put GOOGLE_CLIENT_SECRET      # client secret de Google
# setear GOOGLE_CLIENT_ID en [vars] del wrangler.toml (es público, no es secreto)
npx wrangler deploy
```

> `GOOGLE_CLIENT_ID` va en `[vars]` del `wrangler.toml` (es público). El
> `GOOGLE_CLIENT_SECRET` **nunca** va al repo: se setea con `wrangler secret`.

### DNS

En Cloudflare: Workers → tu Worker → **Custom domain** o **Routes** →
`clientes.shcdigital.net.ar/*` (certificado automático). El dominio
`shcdigital.net.ar` ya está en Cloudflare.

### Agregar un cliente (tenant)

1. En `wrangler.toml`, sumá un objeto a `TENANTS`:
   `{"id":"<cliente>","name":"<Nombre>","admin_url":"https://panel.<cliente>.shcdigital.net.ar","emails":["<email-del-cliente>"]}`
2. En el panel de ese cliente, el Worker debe implementar `/auth/sso` (mismo
   `SHARED_JWT_SECRET`) y tener `TENANT_ID = "<cliente>"`.
3. `wrangler deploy` del SSO y del panel.

### Dar acceso a un email

- **A un solo panel**: agregalo al array `emails` de ese tenant en `TENANTS`.
- **A todos los paneles (admin)**: agregalo a `GOOGLE_ADMIN_EMAILS`.

## Endpoints

| Ruta | Método | Qué hace |
| --- | --- | --- |
| `/` | GET | Bienvenida + login renderizados según la sesión (server-side). |
| `/auth/oauth2/google` | GET | Inicia el login con Google (authorization code + PKCE). |
| `/auth/oauth2/google/callback` | GET | Intercambia `code` → email → crea sesión → `302 /` con cookie. |
| `/auth/me` | GET | Estado de sesión (JSON). |
| `/auth/logout` | GET/POST | Borra sesión y cookie. GET redirige a `/`; POST responde JSON. |
| `/auth/sso/<tenantId>` | GET | Valida sesión + acceso al tenant → emite JWT → redirige al panel. |
| `/auth/login-local` | POST | Login local. **Solo dev**; en producción responde `404`. |

## Login local (solo dev)

Para desarrollar sin Google, seteá `ENABLE_LOCAL_LOGIN = "true"` (en `.dev.vars`)
y usá `admin` / `admin123`. El hash PBKDF2 está en `wrangler.toml` (nunca la
contraseña en claro).

**En producción** (`ENABLE_LOCAL_LOGIN = "false"`):
- `POST /auth/login-local` responde **404** (como si el endpoint no existiera),
  para que un escáner no detecte que hay una auth local oculta.
- El HTML servido **no contiene ninguna referencia** a autenticación local: el
  form y el JS del login local solo se renderizan si está habilitado.

## Seguridad

- `SHARED_JWT_SECRET` y `GOOGLE_CLIENT_SECRET` se setean con `wrangler secret`
  (nunca en el repo).
- OAuth: **PKCE** (S256) + parámetro `state` (anti-CSRF), validación de
  `email_verified` de Google. Los `fetch` a los endpoints de Google están
  envueltos en `try/catch` (una falla de red devuelve 502 controlado, nunca
  excepción).
- **Nunca se devuelve un `1101`**: cualquier excepción se loguea con `console.error`
  y se responde un 500 limpio, para no exponer stack traces ni pistas.
- JWT: TTL 5 min, `aud` específico del panel (impide reuso en otro), y cada
  panel guarda el session id en su propia KV.
- Cookies `HttpOnly; Secure; SameSite=Lax` + CSP en la welcome. `Response.redirect()`
  tiene headers **inmutables**, por eso los `302` con cookie se construyen como
  `new Response(null, { status: 302, headers })`.
- Al cliente solo se le envía `{ name, admin }` en la sesión (no el email) y la
  pantalla muestra "Bienvenido, {nombre}" en vez de la dirección.
- **CSP** permite `static.cloudflareinsights.com` porque Cloudflare inyecta su
  beacon de Web Analytics en las respuestas (igual que el sitio principal).
- Rate-limit del login local en KV (anti fuerza bruta; solo dev).
