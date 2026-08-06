# SHC Digital — SSO de Clientes (`clientes/`)

Worker de Cloudflare que sirve **clientes.shcdigital.net.ar**: la pantalla de
bienvenida y el login del panel de administración de los clientes. Este Worker
es la **única autoridad de login**. Después de autenticar, redirige al panel de
cada cliente (ej. `geo-graficas-admin`) con un **JWT firmado** que el panel
valida para abrir su sesión interna.

## Arquitectura

```
cliente → clientes.shcdigital.net.ar  (Worker SSO — repo web)
             │  welcome + login local (ahora) / Google OAuth (después)
             │  email → TENANTS (config en wrangler.toml)
             ▼
             JWT HS256 (SHARED_JWT_SECRET, TTL 5 min, aud = panel)
             ▼  redirect
       panel del cliente (ej. geo-graficas-admin) /auth/sso
             → valida JWT → sesión KV → cookie → panel
```

## Deploy

```bash
cd clientes
npm i
npx wrangler kv namespace create SESSIONS        # copiar el <id> al wrangler.toml
npx wrangler secret put SHARED_JWT_SECRET         # MISMO valor en el SSO y en cada panel
npx wrangler deploy
```

### DNS

En Cloudflare: Workers → tu Worker → **Custom domain** o **Routes** →
`clientes.shcdigital.net.ar/*` (certificado automático). El dominio
`shcdigital.net.ar` ya está en Cloudflare.

### Agregar un cliente (tenant)

1. En `wrangler.toml`, sumá un objeto a `TENANTS`:
   `{"id":"<cliente>","name":"<Nombre>","admin_url":"https://panel.<cliente>.shcdigital.net.ar","emails":[]}`
2. En el panel de ese cliente, el Worker debe implementar `/auth/sso` (mismo
   `SHARED_JWT_SECRET`) y tener `TENANT_ID = "<cliente>"`.
3. `wrangler deploy` del SSO y del panel.

## Login local (prueba)

`admin` / `admin123`. El hash PBKDF2 está en `wrangler.toml` (nunca la
contraseña en claro). Para cambiar la contraseña, regenerá salt/hash (ver
README de geo-graficas-admin) y actualizá `LOCAL_SALT_B64` / `LOCAL_HASH_B64`.

## Seguridad

- `SHARED_JWT_SECRET` se setea con `wrangler secret` (nunca en el repo).
- JWT: TTL 5 min, `aud` específico del panel (impide reuso en otro), y cada
  panel guarda el session id en su propia KV.
- Cookies `HttpOnly; Secure; SameSite=Lax` + CSP en la welcome.
- Rate-limit del login local en KV (anti fuerza bruta).
