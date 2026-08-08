// shc-briefing-api · Cloudflare Worker — envío de briefings vía Resend
// Sirve (briefing-api.shcdigital.net.ar):
//   POST /send   recibe el briefing (JSON) y envía el mail a shcdigitalsolutions@gmail.com
//   GET  /health healthcheck
//
// La API key de Resend vive como SECRETO (env.RESEND_API_KEY), nunca en el repo.

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

// Orígenes permitidos para CORS (el form vive en shcdigital.net.ar)
const CORS_ORIGINS = [
  "https://shcdigital.net.ar",
  "http://localhost:4321",
  "http://localhost:3000",
  "http://127.0.0.1:4321",
];

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

  const resendBody = {
    from,
    to: [to],
    subject,
    text: prompt,
    html: htmlEmail(prompt),
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

function htmlEmail(text) {
  const esc = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:28px;background:#f2ede6;font-family:'Courier New',monospace;font-size:12px;line-height:1.55;color:#0f0e0c">
  <pre style="white-space:pre-wrap;word-break:break-word;max-width:760px;margin:0 auto">${esc}</pre>
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
