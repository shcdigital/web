// shc-clientes-sso · Cloudflare Worker — SSO de clientes SHC Digital
// Sirve (clientes.shcdigital.net.ar):
//   /              pantalla de bienvenida + login (estilo SHC Digital)
//   /auth/login-local   login local (PBKDF2)
//   /auth/me            estado de sesión
//   /auth/logout
//   /auth/sso/:tenant   autentica y redirige al panel del cliente con un JWT firmado
//
// Arquitectura: este Worker es la ÚNICA autoridad de login. Cada panel de cliente
// (ex: geo-graficas-admin) implementa /auth/sso y valida el JWT con el mismo
// SHARED_JWT_SECRET para abrir su sesión interna sin pedir credenciales.

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8" };
// CSP del HTML: fuentes/estilos desde Google Fonts, scripts inline propios.
const CSP =
  "default-src 'self'; font-src 'self' fonts.googleapis.com fonts.gstatic.com; " +
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com; script-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Seguridad de cabeceras para todas las respuestas HTML/API
    const security = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    };

    // Página de bienvenida + login
    if (url.pathname === "/" || url.pathname === "/home") {
      return new Response(renderWelcome(env), { headers: { ...HTML_HEADERS, ...security, "Content-Security-Policy": CSP } });
    }

    // ---------- API de sesión ----------
    if (url.pathname === "/auth/login-local" && request.method === "POST") {
      return await loginLocal(request, env);
    }
    if (url.pathname === "/auth/me") {
      return await me(request, env);
    }
    if (url.pathname === "/auth/logout" && request.method === "POST") {
      return logout(request, env, url);
    }

    // ---------- Redirect al panel del cliente ----------
    // GET /auth/sso/<tenantId> → valida sesión → emite JWT → 302 al admin del cliente
    const m = url.pathname.match(/^\/auth\/sso\/([a-zA-Z0-9_-]+)$/);
    if (m) return await ssoRedirect(request, env, m[1], url);

    return new Response("Not found", { status: 404, headers: security });
  },
};

// ---------- Rate-limit del login local (anti fuerza bruta) ----------
// Máx intentos fallidos por IP dentro de una ventana. KV: fail:<ip>.
const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW_SEC = 900; // 15 minutos

async function loginLocal(request, env) {
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

  // Usuario local: acceso "global" que ve todos los tenants
  const sessionId = crypto.randomUUID();
  const session = { email: `${user}@local`, name: "Administrador SHC", locals: true };
  await env.SESSIONS.put(`sso:${sessionId}`, JSON.stringify(session), { expirationTtl: 60 * 60 * 12 });

  return resWithSession(json({ ok: true }, 200), sessionId);
}

async function me(request, env) {
  const sessionId = getSession(request);
  const data = sessionId && await env.SESSIONS.get(`sso:${sessionId}`);
  if (!data) return json({ authed: false });
  const session = JSON.parse(data);
  return json({ authed: true, email: session.email, name: session.name, locals: !!session.locals });
}

async function logout(request, env, url) {
  const sessionId = getSession(request);
  if (sessionId) await env.SESSIONS.delete(`sso:${sessionId}`);
  // POST con SameSite=Lax: navegadores no adjuntan la cookie a POST cross-origin,
  // así que un logout forzado desde otro sitio no cierra la sesión (anti-CSRF).
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", clearCookie());
  return res;
}

// ---------- Redirect al panel del cliente ----------
async function ssoRedirect(request, env, tenantId, url) {
  const sessionId = getSession(request);
  const data = sessionId && await env.SESSIONS.get(`sso:${sessionId}`);
  if (!data) return new Response("No autenticado", { status: 401, headers: HTML_HEADERS });

  const tenants = parseTenants(env.TENANTS);
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return new Response("Cliente no encontrado", { status: 404, headers: HTML_HEADERS });

  const session = JSON.parse(data);
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

// ---------- Utilidades ----------
function parseTenants(raw) {
  try { const arr = JSON.parse(raw || "[]"); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
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

// ---------- Render ----------
function renderWelcome(env) {
  // Inyecta config de tenants como JSON (sin secretos)
  return WelcomeHTML.replace("/*__TENANTS__*/[]", JSON.stringify(parseTenants(env.TENANTS)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function resWithSession(res, sessionId) {
  const cookie = `shc_sso=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=${60 * 60 * 12}`;
  return new Response(res.body, { status: res.status, headers: { ...JSON_HEADERS, "Set-Cookie": cookie } });
}

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
  /*__STYLE_BLOCK_START__*/  /*__BRAND_START__*/
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
  .field{margin-bottom:1rem}
  label{display:block;font-size:.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:.35rem}
  input{width:100%;font-family:var(--font-family-base);font-size:1rem;padding:.7rem .9rem;border:1px solid var(--color-border-default);border-radius:10px;background:#fff;color:var(--color-surface-inverse)}
  input:focus{outline:2px solid var(--color-brand-primary-deep);outline-offset:1px;border-color:transparent}
  .btn{display:block;width:100%;border:none;cursor:pointer;font-family:var(--font-family-base);font-weight:600;padding:.85rem 1rem;border-radius:12px;background:var(--color-brand-primary);color:#fff;font-size:1rem;transition:.15s}
  .btn:hover{background:var(--color-brand-primary-deep)}
  .divider{display:flex;align-items:center;gap:.7rem;color:var(--color-text-muted);font-size:.75rem;margin:1.1rem 0;text-transform:uppercase;letter-spacing:.05em}
  .divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--color-border-default)}
  .err{display:none;font-family:var(--font-family-mono);font-size:.8rem;color:var(--color-brand-primary-deep);background:#fbe9e7;border:1px solid #f5c6c0;border-radius:10px;padding:.7rem .9rem;margin-bottom:1rem}
  .tenants{display:grid;gap:.7rem;margin-top:.2rem}
  .tenant{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.1rem;background:#fff;border:1px solid var(--color-border-default);border-radius:12px;cursor:pointer;transition:.15s;text-decoration:none;color:var(--color-surface-inverse)}
  .tenant:hover{border-color:var(--color-brand-primary-deep);box-shadow:0 4px 14px rgba(211,40,26,.12)}
  .tenant .t-name{font-weight:600;font-size:.98rem}
  .tenant .t-go{font-family:var(--font-family-mono);color:var(--color-brand-primary-deep);font-size:.75rem;letter-spacing:.08em}
  .see{font-family:var(--font-family-mono);font-size:.78rem;color:var(--color-text-muted);text-align:center;margin-top:1.2rem;line-height:1.5}
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

        <!-- Login local -->
        <form id="loginForm">
          <div class="field"><label>Usuario</label><input type="text" id="user" autocomplete="username" /></div>
          <div class="field"><label>Contraseña</label><input type="password" id="pass" autocomplete="current-password" /></div>
          <button class="btn" type="submit">Ingresar</button>
        </form>

        <div class="divider">o</div>

        <!-- Tenants disponibles -->
        <div class="tenants" id="tenants"></div>
        <p class="note" id="status">Cargando…</p>
      </div>
    </div>
  </main>
<script>
  const TENANTS = /*__TENANTS__*/[];
  const $ = (id) => document.getElementById(id);
  const err = $("err");
  function showErr(m){err.textContent=m;err.classList.remove("hidden");}
  function clearErr(){err.classList.add("hidden");}
  async function api(path, m){const r=await fetch(path,m);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Error de red");return d;}

  async function check(){
    const s = await api("/auth/me").catch(()=>({authed:false}));
    if(s.authed){
      $("loginForm").style.display="none";
      $("btnSalir").classList.add("show");
      const list=$("tenants");
      list.innerHTML="";
      if(TENANTS.length){
        TENANTS.forEach(t=>{
          const a=document.createElement("a");a.className="tenant";a.href="/auth/sso/"+encodeURIComponent(t.id);
          a.innerHTML='<span class="tname">'+t.name+'</span><span class="t-go">ENTRAR →</span>';
          list.appendChild(a);
        });
        $("status").textContent="Bienvenido, "+s.name+".";
      } else {
        $("status").textContent="No hay clientes configurados.";
      }
    }else{
      $("tenants").style.display="none";
      $("status").textContent="Acceso exclusivo para clientes de SHC Digital.";
    }
  }

  $("loginForm").addEventListener("submit", async (e)=>{
    e.preventDefault();clearErr();const btn=e.target.querySelector("button");btn.disabled=true;
    try{
      await api("/auth/login-local",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user:$("user").value,pass:$("pass").value})});
      location.reload();
    }catch(er){showErr(er.message);btn.disabled=false;}
  });

  $("btnSalir").addEventListener("click", async ()=>{
    await fetch("/auth/logout",{method:"POST"}).catch(()=>{});
    location.reload();
  });

  check();
</script>
</body>
</html>`;