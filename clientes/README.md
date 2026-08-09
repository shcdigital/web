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
npx wrangler secret put GOOGLE_ADMIN_EMAILS       # correos admin globales (csv)
npx wrangler secret put TENANTS                   # JSON de tenants (ver abajo)
# setear GOOGLE_CLIENT_ID en [vars] del wrangler.toml (es público, no es secreto)
npx wrangler deploy
```

> `GOOGLE_CLIENT_ID` va en `[vars]` del `wrangler.toml` (es público). Los secrets
> **nunca** van al repo: `GOOGLE_CLIENT_SECRET`, `SHARED_JWT_SECRET`,
> `GOOGLE_ADMIN_EMAILS` y `TENANTS` se setean con `wrangler secret`.

### DNS

En Cloudflare: Workers → tu Worker → **Custom domain** o **Routes** →
`clientes.shcdigital.net.ar/*` (certificado automático). El dominio
`shcdigital.net.ar` ya está en Cloudflare.

### Agregar/quitar un cliente (tenant)

1. `TENANTS` es un **secret** (JSON string). Para cambiarlo:
   ```bash
   cd clientes
   printf '%s' '[{"id":"geo-graficas","name":"Geo.Gráficas","admin_url":"https://panel.geograficas.shcdigital.net.ar","emails":["revistaliterariatds@gmail.com"]},{"id":"shcdigital","name":"SHC Digital","admin_url":"https://panel.shcdigital.net.ar","emails":["shcdigitalsolutions@gmail.com"]}]' | npx wrangler secret put TENANTS
   npx wrangler deploy
   ```
   - Cada objeto del array: `id` (identifica al tenant), `name` (visible en la
     pantalla), `admin_url` (URL del panel, claim `aud` del JWT) y `emails`
     (correos con acceso a **ese** panel).
2. En el panel de ese cliente, el Worker debe implementar `/auth/sso` (mismo
   `SHARED_JWT_SECRET`) y tener `TENANT_ID = "<cliente>"`.
3. `wrangler deploy` del SSO y del panel.

### Dar/quitar acceso a un email

- **A un solo panel**: editá el array `emails` de ese tenant en `TENANTS` y volvé
  a subir el secret (comando de arriba) + `wrangler deploy`.
- **A todos los paneles (admin)**: editá `GOOGLE_ADMIN_EMAILS` (csv) y subilo de nuevo:
  ```bash
  printf '%s' "mail1@gmail.com,mail2@gmail.com" | npx wrangler secret put GOOGLE_ADMIN_EMAILS
  npx wrangler deploy
  ```
  > Los emails también deben estar como *Test users* en Google Cloud si la app
  > OAuth sigue en modo "Testing".

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

- `SHARED_JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADMIN_EMAILS` y `TENANTS`
  se setean con `wrangler secret` (nunca en el repo ni en `[vars]`).
- Los **emails autorizados no se exponen**: no están en GitHub (son secrets) y el
  HTML servido al cliente solo incluye `id` + `name` de cada panel (ni `emails`
  ni `admin_url`).
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

## Troubleshooting

### "Este email no tiene paneles habilitados" aunque el usuario es admin

Los permisos se evalúan **al momento del login** y quedan congelados en la sesión
(KV, TTL 12 h). Cambiar `GOOGLE_ADMIN_EMAILS` o `TENANTS` no afecta a las sesiones
ya creadas: el usuario debe **volver a loguear** (o borrar su key `sso:<id>` de KV).

Si el problema persiste tras reloguear, puede haber **sesiones huérfanas** del
login local de pruebas (`admin@local`, formato viejo sin `admin`/`tenant_ids`):
la cookie sigue siendo válida pero la sesión no autoriza paneles. Limpiarlas:

```bash
npx wrangler kv key list --binding=SESSIONS --prefix=sso:
# borrar cada key que no corresponda (las sso:<uuid> viejas / admin@local)
npx wrangler kv key delete --binding=SESSIONS "sso:<session-id>"
```

> Nota: si usás la API de Cloudflare (curl) para inspeccionar KV, las keys con `:`
> en el nombre deben URL-encodearse (`sso:` → `sso%3A`); el CLI de wrangler puede
> no listarlas según el carácter.
