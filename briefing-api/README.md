# SHC Digital — API de Briefings (`briefing-api/`)

Worker de Cloudflare que sirve **briefing-api.shcdigital.net.ar**: recibe el
briefing de `briefing.html` (formulario de la guía de preguntas) y envía el
mail con el resumen listo para pegar en una IA a `shcdigitalsolutions@gmail.com`
usando **Resend**.

## Arquitectura

```
cliente → shcdigital.net.ar/briefing.html  (form, estático en GitHub Pages)
             │  POST JSON a briefing-api.shcdigital.net.ar/send
             ▼
       Worker (este repo) → api.resend.com/emails
             │  RESEND_API_KEY (secreto de Cloudflare, no está en el repo)
             ▼
       shcdigitalsolutions@gmail.com  (mail con briefing_prompt)
```

## Deploy

```bash
cd briefing-api
npm i
npx wrangler secret put RESEND_API_KEY        # la key de Resend
npx wrangler deploy
```

El custom domain `briefing-api.shcdigital.net.ar` se crea solo (zona ya en
Cloudflare). El `.gitignore` de la raíz excluye `node_modules/` y `.dev.vars`.

## Nota sobre el remitente (FROM)

Por defecto el mail sale desde `SHC Digital <onboarding@resend.dev>`, que en
Resend **solo entrega a la cuenta dueña** (ideal para probar). Cuando el mail
deba llegar de forma general (o a cualquier dirección), verificá un dominio en
Resend y activá en `wrangler.toml`:

```toml
[vars]
FROM_EMAIL = "SHC Digital <noreply@shcdigital.net.ar>"
```

y luego `npx wrangler deploy`.

## Endpoints

- `POST /send` — body JSON: todos los campos del briefing + `briefing_prompt`
  (resumen armado por el front) + `subject`. Responde `{ ok: true, id }`.
- `GET /health` — healthcheck.

## Seguridad

- `RESEND_API_KEY` es un **secreto** (`wrangler secret`), nunca está en el repo.
- CORS restringido a `shcdigital.net.ar` y localhost.
- Honeypot anti-spam en el formulario (`briefing.html`).
