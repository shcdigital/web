#!/usr/bin/env node
/**
 * sync-brand.mjs
 *
 * Fuente única de marca: brand/tokens.json
 * Genera y sincroniza dos destinos:
 *   1. src/styles/brand.css        → bloque :root consumido por el sitio Astro
 *   2. clientes/src/index.js       → bloque :root del CSS inline del Worker SSO
 *
 * Uso:
 *   npm run sync:brand
 *
 * El script es idempotente: marca los bloques generados con
 * markers /*__BRAND_START__*\/ y /*__BRAND_END__*\/ para reemplazo seguro.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_FILE = resolve(ROOT, "brand/tokens.json");
const ASTRO_OUT = resolve(ROOT, "src/styles/brand.css");
const WORKER_FILE = resolve(ROOT, "clientes/src/index.js");

const START_MARKER = "/*__BRAND_START__*/";
const END_MARKER = "/*__BRAND_END__*/";

function fail(msg) {
  console.error(`✗ sync-brand: ${msg}`);
  process.exit(1);
}

// ── 1. Leer y validar tokens ─────────────────────────────────────────────
let raw;
try {
  raw = JSON.parse(readFileSync(TOKENS_FILE, "utf8"));
} catch (err) {
  fail(`no se pudo leer brand/tokens.json (${err.message})`);
}

const entries = [];
for (const [group, values] of Object.entries(raw)) {
  if (group === "description") continue;
  if (typeof values !== "object" || values === null) continue;
  for (const [name, value] of Object.entries(values)) {
    if (!name.startsWith("--")) fail(`token inválido "${name}" en grupo "${group}"`);
    if (typeof value !== "string" || value.length === 0) {
      fail(`token "${name}" sin valor válido`);
    }
    entries.push([name, value]);
  }
}

if (entries.length === 0) fail("no hay tokens que sincronizar");

// ── 2. Generar bloque :root ──────────────────────────────────────────────
const lines = entries.map(([name, value]) => `  ${name}: ${value};`);
const rootBlock = `:root {\n${lines.join("\n")}\n}`;

// ── 3. Astro: src/styles/brand.css ───────────────────────────────────────
const astroCss = `/* GENERADO por scripts/sync-brand.mjs — NO editar a mano. */
/* Fuente única: brand/tokens.json (ver npm run sync:brand). */

${rootBlock}
`;

mkdirSync(dirname(ASTRO_OUT), { recursive: true });
writeFileSync(ASTRO_OUT, astroCss, "utf8");
console.log(`✓ src/styles/brand.css (${entries.length} tokens)`);

// ── 4. Worker SSO: clientes/src/index.js ─────────────────────────────────
let worker;
try {
  worker = readFileSync(WORKER_FILE, "utf8");
} catch (err) {
  fail(`no se pudo leer ${WORKER_FILE} (${err.message})`);
}

// El bloque vive dentro de un template literal: se indenta 2 espacios por nivel.
const indentBlock = (block) => block.replace(/\n/g, "\n  ");
const workerBlock = `  ${START_MARKER}\n  ${indentBlock(rootBlock)}\n  ${END_MARKER}`;
const pattern = /\s*\/\*__BRAND_START__\*\/[\s\S]*?\/\*__BRAND_END__\*\//;

if (pattern.test(worker)) {
  worker = worker.replace(pattern, workerBlock);
} else {
  // Marker no existe todavía: insertar al inicio del <style> del login.
  const styleAnchor = "/*__STYLE_BLOCK_START__*/";
  if (!worker.includes(styleAnchor)) {
    fail(`no se encontró el marcador ${styleAnchor} en ${WORKER_FILE}. Agregalo manualmente tras <style>.`);
  }
  worker = worker.replace(styleAnchor, `${styleAnchor}\n${workerBlock}`);
}

writeFileSync(WORKER_FILE, worker, "utf8");
console.log(`✓ clientes/src/index.js (:root sincronizado)`);

console.log("✓ brand sincronizada en ambos destinos");
