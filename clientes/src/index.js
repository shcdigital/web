// shc-clientes-sso · Cloudflare Worker — SSO de clientes SHC Digital
// Sirve (clientes.shcdigital.net.ar):
//   /                     pantalla de bienvenida + login (estilo SHC Digital)
//   /auth/oauth2/google   login con Google (authorization code + PKCE)
//   /auth/oauth2/google/callback   intercambio de code → email → sesión
//   /auth/login-local     login local (PBKDF2) — SOLO dev (ENABLE_LOCAL_LOGIN)
//   /auth/me              estado de sesión
//   /auth/logout
//   /auth/sso/:tenant     autentica y redirige al panel del cliente con un JWT firmado
//
// Arquitectura: este Worker es la ÚNICA autoridad de login. Cada panel de cliente
// (ex: geo-graficas-admin) implementa /auth/sso y valida el JWT con el mismo
// SHARED_JWT_SECRET para abrir su sesión interna sin pedir credenciales.
//
// Autorización por email (Google OAuth):
//   - GOOGLE_ADMIN_EMAILS (vars): correos con acceso GLOBAL a todos los tenants.
//   - TENANTS[i].emails (vars): correos permitidos para ese tenant.
//   - Con una sesión, /auth/sso/<tenantId> solo deja pasar si el email de la
//     sesión es admin o está en los emails del tenant.

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8" };
// CSP del HTML: fuentes/estilos desde Google Fonts, scripts inline propios.
// Se permite static.cloudflareinsights.com porque Cloudflare inyecta su beacon
// de Web Analytics en las respuestas (igual que en el sitio principal).
const CSP =
  "default-src 'self'; font-src 'self' fonts.googleapis.com fonts.gstatic.com; " +
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; " +
  "img-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

const SESSION_TTL_SEC = 60 * 60 * 12; // 12 horas

// Seguridad de cabeceras para todas las respuestas HTML/API
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const security = SECURITY_HEADERS;

      // Página de bienvenida + login (server-side según la sesión)
      if (url.pathname === "/" || url.pathname === "/home") {
        return await renderWelcome(request, env, security);
      }

      // ---------- API de sesión ----------
      if (url.pathname === "/auth/login-local" && request.method === "POST") {
        return await loginLocal(request, env);
      }
      if (url.pathname === "/auth/me") {
        return await me(request, env);
      }
      if (url.pathname === "/auth/logout") {
        return await logout(request, env, url);
      }

      // ---------- Google OAuth ----------
      if (url.pathname === "/auth/oauth2/google" && request.method === "GET") {
        return await startGoogleOAuth(env, url, security);
      }
      if (url.pathname === "/auth/oauth2/google/callback" && request.method === "GET") {
        return await googleCallback(request, env, url, security);
      }

      // ---------- Redirect al panel del cliente ----------
      // GET /auth/sso/<tenantId> → valida sesión + acceso al tenant → emite JWT → 302 al admin del cliente
      const m = url.pathname.match(/^\/auth\/sso\/([a-zA-Z0-9_-]+)$/);
      if (m) return await ssoRedirect(request, env, m[1], url, security);

      return new Response("Not found", { status: 404, headers: security });
    } catch (err) {
      // Nunca devolver un 1101 al navegador: loguear la causa y responder 500 limpio.
      console.error("[shc-clientes-sso] excepción sin controlar:", err && err.stack ? err.stack : String(err));
      const msg =
        "Error interno del servidor. Si vuelve a pasar, avisá a SHC Digital con la hora exacta.";
      return new Response(renderErrorPage(msg, 500), {
        status: 500,
        headers: { ...HTML_HEADERS, ...SECURITY_HEADERS, "Content-Security-Policy": CSP },
      });
    }
  },
};

// ---------- Google OAuth (authorization code + PKCE) ----------

function googleAuthorizeUrl(env, url, state, challenge) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleCallbackUrl(url),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
}

function googleCallbackUrl(url) {
  return new URL("/auth/oauth2/google/callback", url.origin).toString();
}

async function startGoogleOAuth(env, url, security) {
  if (!env.GOOGLE_CLIENT_ID) {
    return htmlError("Google login no está configurado. Avisá al administrador.", 503, security);
  }
  const state = crypto.randomUUID();
  const codeVerifier = randomB64url(48);
  const challenge = await pkceChallenge(codeVerifier);
  // state → code_verifier en KV (TTL 10 min); se consume una sola vez en el callback.
  await env.SESSIONS.put(`oauth:${state}`, codeVerifier, { expirationTtl: 600 });
  return Response.redirect(googleAuthorizeUrl(env, url, state, challenge), 302);
}

async function googleCallback(request, env, url, security) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return htmlError("Acceso cancelado.", 403, security);
  if (!code || !state) return htmlError("Parámetros inválidos. Volvé a intentar.", 400, security);

  const verifier = await env.SESSIONS.get(`oauth:${state}`);
  if (!verifier) return htmlError("Estado inválido o expirado. Volvé a intentar.", 400, security);
  await env.SESSIONS.delete(`oauth:${state}`);

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return htmlError("Google login no está configurado. Avisá al administrador.", 503, security);
  }

  // 1) Intercambiar el code por tokens
  let tokenRes;
  try {
    tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleCallbackUrl(url),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
  } catch (err) {
    console.error("[shc-clientes-sso] token endpoint fetch falló:", String(err));
    return htmlError("No se pudo contactar a Google. Intentá de nuevo en unos segundos.", 502, security);
  }
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.access_token) {
    console.warn("[shc-clientes-sso] token exchange falló", tokenRes.status, tokens.error);
    return htmlError("No se pudo completar el login con Google.", 502, security);
  }

  // 2) Obtener la identidad verificada (email) desde Google
  let infoRes;
  try {
    infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
  } catch (err) {
    console.error("[shc-clientes-sso] userinfo endpoint fetch falló:", String(err));
    return htmlError("No se pudo verificar tu identidad de Google. Intentá de nuevo.", 502, security);
  }
  const info = await infoRes.json().catch(() => ({}));
  const email = String(info.email || "").toLowerCase().trim();
  if (!infoRes.ok || !email || info.email_verified !== true) {
    return htmlError("No se pudo verificar tu identidad de Google.", 403, security);
  }

  // 3) Autorización por email → tenants permitidos
  const tenants = parseTenants(env.TENANTS);
  const admin = adminEmails(env).has(email);
  const tenantIds = tenants
    .filter((t) => admin || tenantAllows(t, email))
    .map((t) => t.id);

  if (!admin && tenantIds.length === 0) {
    return htmlError("Este email no tiene acceso a ningún panel. Contactá a SHC Digital.", 403, security);
  }

  // 4) Crear sesión (KV) + cookie
  const sessionId = crypto.randomUUID();
  const session = {
    email,
    name: String(info.name || "").trim() || email,
    admin,
    tenant_ids: tenantIds,
    google: true,
  };
  await env.SESSIONS.put(`sso:${sessionId}`, JSON.stringify(session), { expirationTtl: SESSION_TTL_SEC });
  // OJO: Response.redirect() tiene headers INMUTABLES, no se le puede append.
  // Se construye un Response 302 propio para poder adjuntar la cookie de sesión.
  const res = new Response(null, {
    status: 302,
    headers: {
      Location: new URL("/", url.origin).toString(),
      "Set-Cookie": sessionCookie(sessionId),
    },
  });
  return res;
}

// ---------- Rate-limit del login local (anti fuerza bruta) ----------
const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW_SEC = 900; // 15 minutos

async function loginLocal(request, env) {
  // Deshabilitado: responder 404 como si el endpoint no existiera, para que un
  // escáner no detecte que hay una autenticación local oculta.
  if (env.ENABLE_LOCAL_LOGIN !== "true") {
    return new Response("Not found", { status: 404 });
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "Body inválido" }, 400); }
  const user = String(body.user || "").trim();
  const pass = String(body.pass || "");

  // Bloqueo por IP: si ya superó el límite de fallos, rechaza sin procesar.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (await isBlocked(env, ip)) {
    return json({ error: "Demasiados intentos. Intentá de nuevo más tarde." }, 429);
  }

  if (user !== env.LOCAL_USER) {
    await incrementFail(request, env);
    return json({ error: "Usuario o contraseña incorrectos" }, 401);
  }

  const salt = Uint8Array.from(atob(env.LOCAL_SALT_B64), (c) => c.charCodeAt(0));
  const expected = Uint8Array.from(atob(env.LOCAL_HASH_B64), (c) => c.charCodeAt(0));
  const derived = await pbkdf2(pass, salt);
  if (!constantTimeEqual(derived, expected)) {
    await incrementFail(request, env);
    return json({ error: "Usuario o contraseña incorrectos" }, 401);
  }

  // Login exitoso → limpia el contador de fallos de esta IP.
  await env.SESSIONS.delete(`fail:${ip}`);

  // Usuario local: acceso "global" que ve todos los tenants (solo dev).
  const tenants = parseTenants(env.TENANTS);
  const sessionId = crypto.randomUUID();
  const session = {
    email: `${user}@local`,
    name: "Administrador SHC",
    admin: true,
    tenant_ids: tenants.map((t) => t.id),
    locals: true,
  };
  await env.SESSIONS.put(`sso:${sessionId}`, JSON.stringify(session), { expirationTtl: SESSION_TTL_SEC });

  return resWithSession(json({ ok: true }, 200), sessionId);
}

async function me(request, env) {
  const sessionId = getSession(request);
  const data = sessionId && await env.SESSIONS.get(`sso:${sessionId}`);
  if (!data) return json({ authed: false });
  const session = JSON.parse(data);
  return json({
    authed: true,
    email: session.email,
    name: session.name,
    admin: !!session.admin,
    tenant_ids: session.tenant_ids || [],
  });
}

async function logout(request, env, url) {
  const sessionId = getSession(request);
  if (sessionId) await env.SESSIONS.delete(`sso:${sessionId}`);
  // GET (ej: usuario escribe /auth/logout en la barra o link directo): limpiar la
  // cookie y volver a la portada. Response.redirect() tiene headers inmutables,
  // así que se arma el 302 propio con la cookie de borrado.
  if (request.method === "GET") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL("/", url.origin).toString(),
        "Set-Cookie": clearCookie(),
      },
    });
  }
  // POST con SameSite=Lax: navegadores no adjuntan la cookie a POST cross-origin,
  // así que un logout forzado desde otro sitio no cierra la sesión (anti-CSRF).
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", clearCookie());
  return res;
}

// ---------- Redirect al panel del cliente ----------
async function ssoRedirect(request, env, tenantId, url, security) {
  const sessionId = getSession(request);
  const data = sessionId && await env.SESSIONS.get(`sso:${sessionId}`);
  if (!data) return htmlError("No autenticado.", 401, security);

  const tenants = parseTenants(env.TENANTS);
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return htmlError("Cliente no encontrado.", 404, security);

  const session = JSON.parse(data);
  // Control de acceso por email: admin global o email del tenant.
  const allowed = session.admin || (session.tenant_ids || []).includes(tenantId);
  if (!allowed) return htmlError("No tenés acceso a este panel.", 403, security);

  const token = await signJWT(
    {
      sub: session.email,
      name: session.name,
      tenant: tenant.id,
      aud: tenant.admin_url,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300, // 5 min
    },
    env.SHARED_JWT_SECRET
  );

  // redirect al /auth/sso del panel del cliente con el token
  const target = new URL("/auth/sso", tenant.admin_url);
  target.searchParams.set("token", token);
  return Response.redirect(target.toString(), 302);
}

// ---------- Welcome (server-side según la sesión) ----------
async function renderWelcome(request, env, security) {
  const tenants = parseTenants(env.TENANTS);
  const sessionId = getSession(request);
  const data = sessionId && await env.SESSIONS.get(`sso:${sessionId}`);

  let session = null;
  let allowedTenants = [];
  if (data) {
    session = JSON.parse(data);
    allowedTenants = session.admin
      ? tenants
      : tenants.filter((t) => (session.tenant_ids || []).includes(t.id));
  }

  // Login local: SOLO se renderiza (form + JS) si está habilitado. En producción
  // (ENABLE_LOCAL_LOGIN=false) el HTML servido no contiene NINGUNA referencia a
  // autenticación local, para no dar pistas de un posible acceso con admin.
  const localsEnabled = env.ENABLE_LOCAL_LOGIN === "true";
  const localForm = localsEnabled
    ? '<div class="divider" id="divider">o · acceso local (dev)</div>' +
      '<form id="loginForm">' +
      '<div class="field"><label>Usuario</label><input type="text" id="user" autocomplete="username" /></div>' +
      '<div class="field"><label>Contraseña</label><input type="password" id="pass" autocomplete="current-password" /></div>' +
      '<button class="btn" type="submit">Ingresar</button>' +
      '</form>'
    : "";
  const localJs = localsEnabled
    ? 'const lf = $("loginForm");' +
      'if (lf) lf.addEventListener("submit", async function(e){' +
      'e.preventDefault();clearErr();const btn=e.target.querySelector("button");btn.disabled=true;' +
      'try{await api("/auth/login-local",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user:$("user").value,pass:$("pass").value})});' +
      'location.reload();' +
      '}catch(er){showErr(er.message);btn.disabled=false;}' +
      '});'
    : "";

  // Al cliente solo se le manda lo mínimo: nombre + si es admin (no el email).
  const html = WelcomeHTML
    .replace("/*__TENANTS__*/[]", JSON.stringify(allowedTenants))
    .replace("/*__SESSION__*/null", JSON.stringify(session && { name: session.name, admin: !!session.admin }))
    .replace("/*__LOCAL_FORM__*/", localForm)
    .replace("/*__LOCAL_JS__*/", localJs);

  return new Response(html, {
    headers: { ...HTML_HEADERS, ...security, "Content-Security-Policy": CSP },
  });
}

// ---------- Utilidades ----------
function parseTenants(raw) {
  try { const arr = JSON.parse(raw || "[]"); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}

function adminEmails(env) {
  return new Set(
    String(env.GOOGLE_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function tenantAllows(tenant, email) {
  return (tenant.emails || []).map((e) => String(e).toLowerCase().trim()).includes(email);
}

function randomB64url(bytes = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const base64url = (buf) =>
    btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const header = base64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64url(enc.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${base64url(new Uint8Array(sig))}`;
}

// Rate-limit simple del login local (anti fuerza bruta)
async function incrementFail(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const k = `fail:${ip}`;
  const cur = parseInt(await env.SESSIONS.get(k), 10) || 0;
  await env.SESSIONS.put(k, String(cur + 1), { expirationTtl: LOGIN_WINDOW_SEC });
}

// true si la IP ya superó el máximo de intentos fallidos
async function isBlocked(env, ip) {
  const cur = parseInt(await env.SESSIONS.get(`fail:${ip}`), 10) || 0;
  return cur >= LOGIN_MAX_FAILS;
}

function getSession(request) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)shc_sso=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function sessionCookie(sessionId) {
  return `shc_sso=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${SESSION_TTL_SEC}`;
}

function clearCookie() {
  return "shc_sso=; HttpOnly; Path=/; Max-Age=0; Secure; SameSite=Lax";
}

async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function resWithSession(res, sessionId) {
  return new Response(res.body, {
    status: res.status,
    headers: { ...JSON_HEADERS, "Set-Cookie": sessionCookie(sessionId) },
  });
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderErrorPage(msg, status) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SHC Digital — Panel de Clientes</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet" />
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f0e0c;font-family:'Barlow',sans-serif;color:#f2ede6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
  .box{max-width:420px;width:100%;text-align:center}
  .label{font-family:'Space Mono',monospace;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:#e8321a}
  h1{font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:2rem;letter-spacing:.04em;line-height:1.1;margin-top:.6rem}
  p{color:#999490;font-weight:300;line-height:1.6;margin-top:.75rem}
  a{display:inline-block;margin-top:1.5rem;color:#e8321a;border:1px solid #e8321a;padding:.6rem 1.2rem;text-decoration:none;font-family:'Space Mono',monospace;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase}
</style>
</head>
<body>
  <div class="box">
    <div class="label">// panel de clientes</div>
    <h1>${esc(msg)}</h1>
    <p>SHC Digital — Diseño web con IA</p>
    <a href="/">← Volver</a>
  </div>
</body>
</html>`;
  return html;
}

function htmlError(msg, status, security) {
  return new Response(renderErrorPage(msg, status), {
    status,
    headers: { ...HTML_HEADERS, ...(security || {}), "Content-Security-Policy": CSP },
  });
}

// ---------- Render ----------
const WelcomeHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SHC Digital — Panel de Clientes</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet" />
<style>
  /*__BRAND_START__*/
  :root {
    --color-surface-base: #f2ede6;
    --color-surface-raised: #faf8f4;
    --color-surface-inverse: #0f0e0c;
    --color-surface-inverse-2: #1e1c18;
    --color-surface-card: #141310;
    --color-text-primary: #0f0e0c;
    --color-text-secondary: #6b6358;
    --color-text-muted: #999490;
    --color-text-inverse: #ffffff;
    --color-brand-primary: #e8321a;
    --color-brand-primary-deep: #d3281a;
    --color-brand-primary-dark: #c82a14;
    --color-border-default: #d8d2c8;
    --color-state-success: #1a7a3a;
    --color-line-dark: #222222;
    --font-family-base: 'Barlow', sans-serif;
    --font-family-display: 'Bebas Neue', sans-serif;
    --font-family-mono: 'Space Mono', monospace;
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;
    --spacing-2xl: 3rem;
    --spacing-3xl: 4.5rem;
    --container-max-width: 1200px;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-md: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.5rem;
    --font-size-heading-sm: 1.75rem;
    --font-size-heading-md: 2.25rem;
    --font-size-heading-lg: 3rem;
    --font-weight-regular: 400;
    --font-weight-medium: 500;
    --font-weight-bold: 700;
    --line-height-tight: 1.2;
    --line-height-base: 1.5;
    --line-height-relaxed: 1.7;
    --radius-sm: 0.25rem;
    --radius-md: 0.5rem;
    --radius-lg: 1rem;
    --radius-full: 9999px;
  }
  /*__BRAND_END__*/
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--color-surface-inverse);font-family:var(--font-family-base);color:var(--color-surface-inverse);min-height:100vh;display:flex;flex-direction:column}
  .hidden{display:none!important}
  /* ---- Banner ---- */
  .banner{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.6rem 1rem;background:var(--color-surface-inverse-2);border-bottom:1px solid rgba(255,255,255,.06)}
  .banner .brand{display:flex;align-items:baseline;gap:.6rem;margin:0 auto}
  .banner .type{font-family:var(--font-family-display);font-size:clamp(1.6rem,6vw,3rem);color:#fff;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
  .banner .dot{color:var(--color-brand-primary)}
  .banner .sub{font-family:var(--font-family-mono);font-size:.7rem;color:#999;letter-spacing:.2em;text-transform:uppercase}
  .banner .btn-exit{display:none;font-family:var(--font-family-mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:transparent;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:.5rem 1.1rem;cursor:pointer;transition:.15s;white-space:nowrap}
  .banner .btn-exit.show{display:inline-block}
  .banner .btn-exit:hover{background:var(--color-brand-primary);border-color:var(--color-brand-primary)}
  main{flex:1;display:flex;align-items:center;justify-content:center;padding:2rem 1.25rem 4rem}
  .card{width:100%;max-width:440px;background:var(--color-surface-base);border-radius:18px;border:1px solid var(--color-border-default);box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden}
  .card-head{padding:2rem 2rem 1.4rem;background:#fff;border-bottom:1px solid var(--color-border-default)}
  .card-head h1{font-family:var(--font-family-display);font-size:1.7rem;letter-spacing:.06em;line-height:1}
  .card-head h1 span{color:var(--color-brand-primary-deep)}
  .card-head p{color:var(--color-text-secondary);font-size:.92rem;margin-top:.5rem;line-height:1.4}
  .card-body{padding:1.6rem 2rem 2rem}
  .gbtn{display:flex;align-items:center;justify-content:center;gap:.75rem;width:100%;background:#fff;border:1px solid var(--color-border-default);border-radius:12px;color:var(--color-surface-inverse);font-family:var(--font-family-base);font-weight:600;font-size:1rem;padding:.85rem 1rem;cursor:pointer;text-decoration:none;transition:.15s}
  .gbtn:hover{border-color:var(--color-brand-primary-deep);box-shadow:0 4px 14px rgba(211,40,26,.12)}
  .gbtn .g{display:flex;align-items:center;justify-content:center}
  .field{margin-bottom:1rem}
  label{display:block;font-size:.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:.35rem}
  input{width:100%;font-family:var(--font-family-base);font-size:1rem;padding:.7rem .9rem;border:1px solid var(--color-border-default);border-radius:10px;background:#fff;color:var(--color-surface-inverse)}
  input:focus{outline:2px solid var(--color-brand-primary-deep);outline-offset:1px;border-color:transparent}
  .btn{display:block;width:100%;border:none;cursor:pointer;font-family:var(--font-family-base);font-weight:600;padding:.85rem 1rem;border-radius:12px;background:var(--color-brand-primary);color:#fff;font-size:1rem;transition:.15s}
  .btn:hover{background:var(--color-brand-primary-deep)}
  .divider{display:flex;align-items:center;gap:.7rem;color:var(--color-text-muted);font-size:.75rem;margin:1.1rem 0;text-transform:uppercase;letter-spacing:.05em}
  .divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--color-border-default)}
  .err{font-family:var(--font-family-mono);font-size:.8rem;color:var(--color-brand-primary-deep);background:#fbe9e7;border:1px solid #f5c6c0;border-radius:10px;padding:.7rem .9rem;margin-bottom:1rem}
  .tenants{display:grid;gap:.7rem;margin-top:.2rem}
  .tenant{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.1rem;background:#fff;border:1px solid var(--color-border-default);border-radius:12px;cursor:pointer;transition:.15s;text-decoration:none;color:var(--color-surface-inverse)}
  .tenant:hover{border-color:var(--color-brand-primary-deep);box-shadow:0 4px 14px rgba(211,40,26,.12)}
  .tenant .t-name{font-weight:600;font-size:.98rem}
  .tenant .t-go{font-family:var(--font-family-mono);color:var(--color-brand-primary-deep);font-size:.75rem;letter-spacing:.08em}
  .logged-email{font-family:var(--font-family-mono);font-size:.78rem;color:var(--color-text-muted);text-align:center;margin-bottom:1.1rem;line-height:1.5}
  .note{font-family:var(--font-family-mono);font-size:.72rem;color:var(--color-text-muted);text-align:center;margin-top:1rem;line-height:1.5}
</style>
</head>
<body>
  <div class="banner">
    <div class="brand">
      <div class="type">SHC<span class="dot">.</span>DIGITAL</div>
    </div>
    <button class="btn-exit hidden" id="btnSalir">Salir</button>
  </div>
  <main>
    <div class="card">
      <div class="card-head">
        <h1>Panel de <span>Clientes</span></h1>
        <p>Bienvenido a tu espacio de administración. Ingresá para acceder a los paneles de gestión de tu sitio.</p>
      </div>
      <div class="card-body">
        <div class="err hidden" id="err"></div>

        <!-- Acceso no autenticado -->
        <a class="gbtn" id="googleBtn" href="/auth/oauth2/google">
          <span class="g"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg></span>
          Continuar con Google
        </a>
        /*__LOCAL_FORM__*/

        <!-- Sesión iniciada -->
        <div id="sessionBlock" class="hidden">
          <p class="logged-email" id="loggedEmail"></p>
          <div class="tenants" id="tenants"></div>
        </div>
        <p class="note" id="status">Cargando…</p>
      </div>
    </div>
  </main>
<script>
  const TENANTS = /*__TENANTS__*/[];
  const SESSION = /*__SESSION__*/null;
  const $ = (id) => document.getElementById(id);
  const err = $("err");
  function showErr(m){err.textContent=m;err.classList.remove("hidden");}
  function clearErr(){err.classList.add("hidden");}
  async function api(path, m){const r=await fetch(path,m);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Error de red");return d;}

  function render(){
    if (SESSION) {
      $("googleBtn").classList.add("hidden");
      $("sessionBlock").classList.remove("hidden");
      $("btnSalir").classList.add("show");
      $("loggedEmail").textContent = "Bienvenido, " + SESSION.name;
      const list = $("tenants");
      list.innerHTML = "";
      if (TENANTS.length) {
        TENANTS.forEach(function(t){
          const a = document.createElement("a");
          a.className = "tenant";
          a.href = "/auth/sso/" + encodeURIComponent(t.id);
          a.innerHTML = '<span class="t-name">' + t.name + '</span><span class="t-go">ENTRAR →</span>';
          list.appendChild(a);
        });
        $("status").textContent = "Elegí tu panel para continuar.";
      } else {
        $("status").textContent = "Este email no tiene paneles habilitados.";
      }
    } else {
      $("sessionBlock").classList.add("hidden");
      $("googleBtn").classList.remove("hidden");
      $("status").textContent = "Acceso exclusivo para clientes de SHC Digital.";
    }
  }

  /*__LOCAL_JS__*/

  $("btnSalir").addEventListener("click", async function(){
    await fetch("/auth/logout",{method:"POST"}).catch(function(){});
    location.reload();
  });

  render();
</script>
</body>
</html>`;
