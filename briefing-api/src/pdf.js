// pdf.js — Generador de PDF mínimo para presupuestos (sin dependencias).
//
// Crea un PDF válido con fuentes Helvetica (Base-14, siempre disponibles) y
// codificación WinAnsi, que cubre los acentos del español (á é í ó ú ñ ü ¿ ¡).
// Se usa para adjuntar el presupuesto al mail del briefing.

// Mapeo unicode → byte WinAnsi para caracteres fuera del ASCII.
// (los que no están en la tabla se convierten en "?" a propósito)
const WINANSI = {
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x2022: 0x95, // •
  0x00b7: 0xb7, // ·
};

function toWinAnsi(s) {
  let out = "";
  for (const ch of String(s == null ? "" : s)) {
    const c = ch.codePointAt(0);
    let b;
    if (c < 128) b = c;
    else if (WINANSI[c] != null) b = WINANSI[c];
    else b = c <= 0xff ? c : 0x3f; // latin-1 directo; el resto → "?"
    if (b === 40 || b === 41 || b === 92) out += "\\"; // ( ) \
    out += String.fromCharCode(b);
  }
  return out;
}

// Convierte una cadena con bytes latinos (chars 0-255) a Uint8Array.
function latinBytes(str) {
  const u8 = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) u8[i] = str.charCodeAt(i) & 0xff;
  return u8;
}

function base64FromBytes(u8) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// Elementos de contenido por página.
// cmd: { t: 'text', x, y, size, font: 'F1'|'F2', r, g, b, s }
//      { t: 'rect', x, y, w, h, r, g, b }
const PAGE_W = 595;
const PAGE_H = 842;

function buildContent(cmds) {
  const parts = [];
  for (const c of cmds) {
    if (c.t === "rect") {
      parts.push(`${c.r} ${c.g} ${c.b} rg ${c.x} ${c.y} ${c.w} ${c.h} re f`);
    } else if (c.t === "text") {
      parts.push(
        `BT /${c.font || "F2"} ${c.size} Tf ${c.r ?? 0} ${c.g ?? 0} ${c.b ?? 0} rg ${c.x} ${c.y} Td (${toWinAnsi(c.s)}) Tj ET`
      );
    }
  }
  return parts.join("\n");
}

// Ensambla el PDF a partir de un array de páginas (cada una con sus cmds).
function assemble(pages) {
  const fontRes = "<< /F1 4 0 R /F2 5 0 R >>";
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = null; // /Pages (se arma después, conoce los kids)
  objects[3] = null; // se reserva para el primer /Page

  const kidIds = [];
  const contentIds = [];
  let nextId = 6; // 4 y 5 son las fuentes
  for (let i = 0; i < pages.length; i++) {
    const pageId = nextId++;
    const contentId = nextId++;
    kidIds.push(pageId);
    contentIds.push(contentId);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font ${fontRes} >> /Contents ${contentId} 0 R >>`;
    const stream = buildContent(pages[i]);
    objects[contentId] = `<< /Length ${latinBytes(stream).length} >>\nstream\n${stream}\nendstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${kidIds.map((id) => id + " 0 R").join(" ")}] /Count ${kidIds.length} >>`;
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  let out = "%PDF-1.4\n";
  const offsets = new Array(nextId + 1).fill(0);
  for (let id = 1; id <= nextId; id++) {
    if (objects[id] == null) continue;
    offsets[id] = latinBytes(out).length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefPos = latinBytes(out).length;
  out += `xref\n0 ${nextId + 1}\n`;
  out += "0000000000 65535 f \n";
  for (let id = 1; id <= nextId; id++) {
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${nextId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return latinBytes(out);
}

// Estilos de marca (tokens SHC)
const INK = [0.06, 0.05, 0.05]; // #0f0e0c
const RED = [0.91, 0.2, 0.1]; // #e8321a
const GRAY = [0.42, 0.39, 0.35]; // #6b6358
const LIGHT = [0.6, 0.58, 0.56]; // #999490
const WHITE = [1, 1, 1];

const fmtUsd = (n) => "USD " + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

// Genera el PDF del presupuesto.
// budget → salida de computeBudget() (items, total_offer, total_list, etc.)
// Devuelve { bytes, name } listo para adjuntar.
export function budgetPdf(budget) {
  const cmds = [];
  let y = PAGE_H - 60;

  const text = (s, size, font, x, color, advance = size + 4) => {
    cmds.push({ t: "text", s, x, y, size, font: font || "F2", r: color[0], g: color[1], b: color[2] });
    y -= advance;
  };

  // Banda de cabecera oscura
  cmds.push({ t: "rect", x: 40, y: PAGE_H - 100, w: PAGE_W - 80, h: 48, r: INK[0], g: INK[1], b: INK[2] });
  cmds.push({ t: "text", s: "SHC.DIGITAL", x: 55, y: PAGE_H - 86, size: 18, font: "F1", r: WHITE[0], g: WHITE[1], b: WHITE[2] });
  cmds.push({ t: "text", s: "PRESUPUESTO ESTIMADO · diseño web con IA", x: 55, y: PAGE_H - 68, size: 8, font: "F2", r: LIGHT[0], g: LIGHT[1], b: LIGHT[2] });
  // Línea roja
  cmds.push({ t: "rect", x: 40, y: PAGE_H - 104, w: PAGE_W - 80, h: 4, r: RED[0], g: RED[1], b: RED[2] });

  y = PAGE_H - 130;

  // Datos del cliente
  text("Cliente: " + (budget.cliente || "—") + (budget.empresa ? "  ·  " + budget.empresa : ""), 10, "F2", 55, INK);
  text("Email: " + (budget.email || "—"), 10, "F2", 55, INK);
  text("Plazo elegido: " + (budget.plazo || "—"), 10, "F2", 55, INK);
  text("Fecha: " + new Date(budget.fecha).toLocaleDateString("es-AR"), 10, "F2", 55, INK);
  y -= 8;

  // Separador
  cmds.push({ t: "rect", x: 55, y: y, w: PAGE_W - 110, h: 1, r: 0.84, g: 0.82, b: 0.78 });
  y -= 16;

  // Encabezado de tabla
  text("ÍTEM", 8, "F1", 55, GRAY, 14);
  text("TOTAL", 8, "F1", 470, GRAY, 14);
  y -= 4;

  // Filas
  for (const it of budget.items) {
    const label = it.qty > 1 ? it.name + " × " + it.qty : it.name;
    text(label, 9.5, "F2", 55, INK, 15);
    text(fmtUsd(it.subtotal_offer), 9.5, "F2", 470, INK, 15);
  }

  y -= 6;

  // Subtotal lista (referencia)
  text("Precio de lista (referencia): " + fmtUsd(budget.total_list), 8.5, "F2", 55, LIGHT, 16);

  // Total oferta (destacado)
  cmds.push({ t: "rect", x: 55, y: y - 4, w: PAGE_W - 110, h: 1, r: 0.84, g: 0.82, b: 0.78 });
  y -= 16;
  cmds.push({ t: "text", s: "TOTAL OFERTA 2026:", x: 55, y, size: 11, font: "F1", r: RED[0], g: RED[1], b: RED[2] });
  cmds.push({ t: "text", s: fmtUsd(budget.total_offer), x: 470, y, size: 11, font: "F1", r: RED[0], g: RED[1], b: RED[2] });
  y -= 18;

  // Notas
  text("Oferta 60% OFF vigente durante 2026 · pago único, sin costos mensuales.", 7.5, "F2", 55, GRAY, 12);
  text("El presupuesto final se ajusta al detallar el alcance del proyecto.", 7.5, "F2", 55, GRAY, 12);
  text("SHC Digital — Diseño web con IA · shcdigital.net.ar", 7.5, "F2", 55, LIGHT, 12);

  const bytes = assemble([cmds]);
  const slug = (budget.cliente || "cliente").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "cliente";
  return { bytes, name: `presupuesto-${slug}.pdf` };
}

// Prepara el adjunto base64 para Resend.
export function budgetAttachment(budget) {
  const { bytes, name } = budgetPdf(budget);
  return { filename: name, content: base64FromBytes(bytes), content_type: "application/pdf" };
}
