// shc-briefing-api · Cloudflare Worker — envío de briefings vía Resend
// Sirve (briefing-api.shcdigital.net.ar):
//   POST /send   recibe el briefing (JSON) y envía el mail a shcdigitalsolutions@gmail.com
//   GET  /health healthcheck
//
// La API key de Resend vive como SECRETO (env.RESEND_API_KEY), nunca en el repo.
//
// Protección anti-abuso (agregada 2026-08):
//   - Rate-limit por IP en KV: máx RATE_LIMIT_MAX envíos por ventana.
//   - Límite de tamaño del body JSON (MAX_BODY_BYTES).
//   - Validación de origen: si el request trae Origin (navegador), debe estar
//     en la whitelist. Nota: el rate-limit es el control real; CORS/origen solo
//     es defensa en profundidad (un bot con curl puede no enviar Origin).

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

// Orígenes permitidos para CORS (el form vive en shcdigital.net.ar)
const CORS_ORIGINS = [
  "https://shcdigital.net.ar",
  "http://localhost:4321",
  "http://localhost:3000",
  "http://127.0.0.1:4321",
];

// Rate-limit por IP: hasta RATE_LIMIT_MAX envíos por IP dentro de una ventana.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SEC = 600; // 10 minutos

// Tamaño máximo del body JSON (briefings con adjuntos en base64: hasta 3 fotos
// de 3 MB + 1 logo de 3 MB ≈ 16 MB en base64; dejamos margen).
const MAX_BODY_BYTES = 32 * 1024 * 1024; // 32 MB

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/health") {
      return json({ ok: true }, 200, origin);
    }

    if (url.pathname === "/send" && request.method === "POST") {
      return await sendBriefing(request, env, origin);
    }

    return json({ error: "Not found" }, 404, origin);
  },
};

async function sendBriefing(request, env, origin) {
  // 1. Validación de origen (defensa en profundidad; no es el control principal)
  if (origin && !CORS_ORIGINS.includes(origin)) {
    return json({ error: "Origen no permitido" }, 403, origin);
  }

  // 2. Límite de tamaño del body
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "Body demasiado grande" }, 413, origin);
  }

  // 3. Rate-limit por IP
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rl = await checkRateLimit(env, ip);
  if (!rl.allowed) {
    return json({ error: "Demasiados envíos. Esperá unos minutos e intentá de nuevo.", retry_after: rl.retry_after }, 429, origin);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Body JSON inválido" }, 400, origin); }

  const nombre = String(body.nombre || "").trim();
  const email = String(body.email || "").trim();

  if (!nombre) return json({ error: "Falta el nombre" }, 400, origin);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email inválido" }, 400, origin);

  // El resumen listo para pegar en la IA lo arma el front (buildPrompt) y viaja en briefing_prompt
  const prompt = String(body.briefing_prompt || "").trim() || "Sin resumen.";
  const subject = String(body.subject || "").trim() || "Nuevo briefing web — SHC Digital";
  const from = env.FROM_EMAIL || "SHC Digital <onboarding@resend.dev>";
  const to = env.TO_EMAIL || "shcdigitalsolutions@gmail.com";

  // Adjuntos (logo + fotos en base64)
  const attachments = [];
  const logoFile = body.logo_file;
  if (logoFile && logoFile.data && logoFile.name) {
    attachments.push({ filename: logoFile.name, content: logoFile.data, content_type: logoFile.type || "application/octet-stream" });
  }
  const fotos = Array.isArray(body.fotos_files) ? body.fotos_files : [];
  for (const f of fotos) {
    if (f && f.data && f.name) {
      attachments.push({ filename: f.name, content: f.data, content_type: f.type || "application/octet-stream" });
    }
  }

  const resendBody = {
    from,
    to: [to],
    subject,
    text: textEmail(body, prompt),
    html: htmlEmail(body, prompt),
    ...(attachments.length ? { attachments } : {}),
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendBody),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ error: "Resend error", detail: data.message || data }, 502, origin);
  }
  return json({ ok: true, id: data.id }, 200, origin);
}

// ---------- Rate-limit por IP (KV, ventana deslizante aproximada) ----------
async function checkRateLimit(env, ip) {
  const now = Math.floor(Date.now() / 1000);
  const key = `rl:${ip}`;
  const raw = await env.SHC_RATELIMIT?.get(key);
  const entry = raw ? JSON.parse(raw) : null;

  // Ventana expirada o primera vez → arranca ventana nueva con 1 envío
  if (!entry || entry.expires_at <= now) {
    await env.SHC_RATELIMIT?.put(key, JSON.stringify({ count: 1, expires_at: now + RATE_LIMIT_WINDOW_SEC }), { expirationTtl: RATE_LIMIT_WINDOW_SEC });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retry_after: entry.expires_at - now };
  }

  entry.count += 1;
  await env.SHC_RATELIMIT?.put(key, JSON.stringify(entry), { expirationTtl: entry.expires_at - now });
  return { allowed: true };
}

// ---------- Armado del mail profesional ----------
// Estructura: cabecera SHC.DIGITAL + bloque de datos del cliente (formato
// profesional) + bloque con el prompt para la IA (listo para copiar y pegar).

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Datos de contacto/profesionales que van "aparte" del prompt (formato tabular)
const CLIENT_FIELDS = [
  ["Nombre y apellido", "nombre"],
  ["Empresa / Marca", "empresa"],
  ["Rubro / Profesión", "rubro"],
  ["Email", "email"],
  ["WhatsApp", "whatsapp"],
  ["Ciudad / País", "ciudad"],
  ["Redes sociales", "redes"],
  ["Plan elegido", "plan"],
  ["Plazo", "plazo"],
  ["Dominio", "dominio"],
];

function clientRows(body) {
  const rows = [];
  for (const [label, key] of CLIENT_FIELDS) {
    let value = "";
    if (key === "redes") {
      const arr = Array.isArray(body && body.redes) ? body.redes : [];
      const conUser = Array.isArray(body && body.redes_con_usuarios)
        ? body.redes_con_usuarios
        : [];
      const parts = conUser.length
        ? conUser.map((r) => {
            const red = String(r && r.red ? r.red : "").trim();
            const usr = String(r && r.usuario ? r.usuario : "").trim();
            return usr ? red + " (@" + usr + ")" : red;
          })
        : arr;
      const otras = String((body && body.redes_otras) || "").trim();
      value = parts.concat(otras ? [otras] : []).join(", ");
    } else {
      value = String(body && body[key] != null ? body[key] : "").trim();
      if (Array.isArray(body && body[key])) value = body[key].join(", ");
    }
    if (key === "dominio" && body && body.dominio_disponible != null) {
      value = value + " — " + (body.dominio_disponible ? "DISPONIBLE" : "REGISTRADO");
    }
    if (value) rows.push([label, value]);
  }
  return rows;
}

function textEmail(body, prompt) {
  const L = [];
  L.push("SHC DIGITAL — NUEVO BRIEFING WEB");
  L.push("══════════════════════════════════════════");
  L.push("");
  L.push("DATOS DEL CLIENTE");
  for (const [label, value] of clientRows(body)) L.push("• " + label + ": " + value);
  L.push("");
  L.push("PROMPT PARA LA IA");
  L.push("──────────────────────────────────────────");
  L.push(prompt);
  return L.join("\n");
}

function htmlEmail(body, prompt) {
  const rows = clientRows(body)
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:0.55rem 1.1rem;border-bottom:1px solid #e8e2d8;font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b6358;white-space:nowrap;vertical-align:top">${escHtml(label)}</td>
        <td style="padding:0.55rem 1.1rem;border-bottom:1px solid #e8e2d8;font-size:0.9rem;color:#0f0e0c;vertical-align:top">${escHtml(value)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f2ede6;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f0e0c">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;border-collapse:collapse">

    <!-- CABECERA -->
    <tr>
      <td style="background:#0f0e0c;padding:1.6rem 2rem;border-bottom:4px solid #e8321a">
        <div style="font-family:'Arial Black',Arial,sans-serif;font-size:1.6rem;font-weight:900;letter-spacing:0.06em;color:#ffffff">SHC<span style="color:#e8321a">.</span>DIGITAL</div>
        <div style="font-family:'Courier New',monospace;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:#999490;margin-top:0.25rem">// nuevo briefing web · diseño con IA</div>
      </td>
    </tr>

    <!-- DATOS DEL CLIENTE -->
    <tr>
      <td style="padding:2rem 2rem 0">
        <div style="font-family:'Courier New',monospace;font-size:0.68rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#e8321a;margin-bottom:0.4rem">// datos del cliente</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d8d2c8;border-radius:8px;border-collapse:collapse;overflow:hidden">
          <tr><td style="padding:0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              ${rows || '<tr><td style="padding:0.75rem 1.1rem;color:#6b6358">—</td></tr>'}
            </table>
          </td></tr>
        </table>
      </td>
    </tr>

    <!-- PROMPT PARA LA IA -->
    <tr>
      <td style="padding:2rem">
        <div style="font-family:'Courier New',monospace;font-size:0.68rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#e8321a;margin-bottom:0.4rem">// prompt para la IA · copiar y pegar</div>
        <pre style="margin:0;background:#0f0e0c;border-radius:8px;color:#e8e2d8;font-family:'Courier New',monospace;font-size:0.78rem;line-height:1.6;padding:1.2rem 1.3rem;white-space:pre-wrap;word-break:break-word;overflow:hidden">${escHtml(prompt)}</pre>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="padding:0 2rem 2rem;text-align:center;font-family:'Courier New',monospace;font-size:0.65rem;letter-spacing:0.12em;color:#6b6358">
        SHC Digital — Diseño web con IA · <a href="https://shcdigital.net.ar" style="color:#e8321a;text-decoration:none">shcdigital.net.ar</a>
      </td>
    </tr>

  </table>
</body>
</html>`;
}

function corsHeaders(origin) {
  const allow = CORS_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin) },
  });
}
