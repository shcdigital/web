// nomenclador.js — Fuente de verdad de precios (INTERNO) de SHC Digital.
//
// Reemplaza a la página pública /nomenclador (eliminada). Vive SOLO acá, en el
// worker briefing-api, para que los precios no viajen en el bundle del sitio.
// Se actualizan al hacer deploy de este worker (npm run deploy).
//
// Convención: la "oferta 2026" (60% OFF) es el 40% del precio de lista.
// Estructura: { key, cat, name, detail, list, offer, per? }
//   key    — identificador estable (lo usan el presupuesto y el PDF)
//   cat    — categoría del nomenclador
//   name   — ítem tal cual se muestra en el presupuesto
//   detail — descripción corta
//   list   — precio de lista (referencia de mercado, USD)
//   offer  — precio de oferta 2026 (USD)
//   per    — opcional: 'mes' para servicios recurrentes
//
// COBERTURA DEL BRIEFING: cada opción del formulario mapea a un ítem vía
// computeBudget() (ver abajo). Los ítems marcados con "// NUEVO" no existían
// en el nomenclador original y se agregaron para cubrir el briefing completo.

export const NOMENCLADOR = [
  // ─────────── BASE DE SITIO ───────────
  { key: "base_landing", cat: "Base de sitio", name: "Landing page (1 sección)", detail: "Una página: hero + contacto. Ideal para validar o campañas.", list: 250, offer: 100 },
  { key: "base_sitio_1_3", cat: "Base de sitio", name: "Sitio 1–3 páginas", detail: "Landing + 2 páginas internas (servicios, términos).", list: 400, offer: 160 },
  { key: "base_corporativo", cat: "Base de sitio", name: "Sitio corporativo (hasta 5 páginas)", detail: "Home + secciones + páginas internas. Perfil empresa.", list: 550, offer: 220 },
  { key: "base_multipagina", cat: "Base de sitio", name: "Sitio multi-página (6–10 páginas)", detail: "Sitios institucionales con varias áreas o servicios.", list: 800, offer: 320 },
  { key: "base_ecom_basico", cat: "Base de sitio", name: "E-commerce básico", detail: "Hasta 30 productos, carrito + pasarela de pago.", list: 1200, offer: 480 },
  { key: "base_ecom_full", cat: "Base de sitio", name: "E-commerce completo", detail: "Catálogo amplio, stock, pagos, integraciones.", list: 2500, offer: 1000 },
  { key: "ext_pagina", cat: "Base de sitio", name: "Página adicional", detail: "Sobre cualquier base del sitio.", list: 60, offer: 24 },
  { key: "ext_seccion", cat: "Base de sitio", name: "Sección extra", detail: "Bloque nuevo dentro de una página existente.", list: 25, offer: 10 },
  { key: "ext_ronda", cat: "Base de sitio", name: "Ronda de revisión adicional", detail: "Más allá de las 2 rondas incluidas.", list: 25, offer: 10 },

  // ─────────── DISEÑO ───────────
  { key: "diseno_ia", cat: "Diseño", name: "Diseño a medida con IA", detail: "Incluido en toda base de sitio (identidad + layout).", list: 0, offer: 0 },
  { key: "rediseno", cat: "Diseño", name: "Rediseño / restyling", detail: "Actualización visual de un sitio existente.", list: 150, offer: 60 },
  { key: "logo_simple", cat: "Diseño", name: "Logo simple", detail: "Símbolo + tipografía, 1 propuesta.", list: 60, offer: 24 },
  { key: "logo_profesional", cat: "Diseño", name: "Logo profesional", detail: "2–3 propuestas + variantes + vectoriales.", list: 120, offer: 48 },
  { key: "manual_marca", cat: "Diseño", name: "Manual de marca", detail: "Usos, paleta, tipografías, aplicaciones básicas.", list: 200, offer: 80 },
  { key: "paleta_tipografia", cat: "Diseño", name: "Paleta + tipografía", detail: "Definición de colores y fuentes para el sitio.", list: 40, offer: 16 },

  // ─────────── FUNCIONALIDADES ───────────
  { key: "form_contacto", cat: "Funcionalidades", name: "Formulario de contacto", detail: "Envío a email / hoja de cálculo (Apps Script).", list: 50, offer: 20 },
  { key: "wa_flotante", cat: "Funcionalidades", name: "Botón WhatsApp flotante", detail: "Acceso directo de conversación.", list: 20, offer: 8 },
  { key: "multi_idioma", cat: "Funcionalidades", name: "Multi-idioma", detail: "Segunda versión del sitio (es/en).", list: 150, offer: 60 },
  { key: "blog", cat: "Funcionalidades", name: "Blog (hasta 5 posts)", detail: "Sección de publicaciones + carga inicial.", list: 200, offer: 80 },
  { key: "reservas", cat: "Funcionalidades", name: "Calendario de reservas", detail: "Agenda online para turnos/citas.", list: 120, offer: 48 },
  { key: "carrito", cat: "Funcionalidades", name: "Carrito + pasarela de pago", detail: "Mercado Pago / Stripe, para e-commerce.", list: 300, offer: 120 },
  // NUEVO — galería/portfolio (opción del briefing)
  { key: "galeria", cat: "Funcionalidades", name: "Galería / portfolio con imágenes", detail: "Galería responsive con lightbox y organización por categorías.", list: 60, offer: 24 },
  // NUEVO — botón de pago suelto (distinto del carrito completo)
  { key: "boton_pago", cat: "Funcionalidades", name: "Botón de pago (Mercado Pago / Stripe)", detail: "Checkout simple sin carrito completo.", list: 60, offer: 24 },
  // NUEVO — mapa de ubicación
  { key: "mapa", cat: "Funcionalidades", name: "Mapa de ubicación", detail: "Mapa embebido de la zona / ubicación del negocio.", list: 25, offer: 10 },
  // NUEVO — enlaces a redes sociales
  { key: "redes", cat: "Funcionalidades", name: "Enlaces a redes sociales", detail: "Botones e íconos a tus perfiles.", list: 15, offer: 6 },
  // NUEVO — sub-opción del briefing: página de edición/actualización de blog
  { key: "blog_edicion", cat: "Funcionalidades", name: "Página de edición y actualización de blog", detail: "Panel para que publiques y edites tus posts.", list: 80, offer: 32 },
  // NUEVO — sub-opción del briefing: página de edición/actualización de precios
  { key: "precios_edicion", cat: "Funcionalidades", name: "Página de edición y actualización de precios / paquetes", detail: "Panel para que actualices tus precios.", list: 40, offer: 16 },

  // ─────────── SEO / ANALÍTICA ───────────
  { key: "seo_tecnico", cat: "SEO y analítica", name: "SEO técnico base", detail: "Estructura, metas, velocidad, etiquetas.", list: 40, offer: 16 },
  { key: "seo_onpage", cat: "SEO y analítica", name: "SEO on-page", detail: "Palabras clave, títulos y descripciones por página.", list: 80, offer: 32 },
  { key: "analytics", cat: "SEO y analítica", name: "Google Analytics", detail: "Configuración y verificación.", list: 20, offer: 8 },
  { key: "gmb", cat: "SEO y analítica", name: "Google Business Profile", detail: "Ficha de negocio en Google Maps.", list: 30, offer: 12 },
  { key: "seo_avanzado", cat: "SEO y analítica", name: "SEO avanzado (contenido)", detail: "Plan de contenidos + optimización editorial.", list: 200, offer: 80 },

  // ─────────── CONTENIDO ───────────
  { key: "redaccion", cat: "Contenido", name: "Redacción por página", detail: "Textos optimizados, listos para publicar.", list: 30, offer: 12 },
  { key: "copy_hero", cat: "Contenido", name: "Copywriting hero / landing", detail: "Titulares y propuesta de valor que convierten.", list: 50, offer: 20 },
  { key: "carga_contenido", cat: "Contenido", name: "Carga de contenido provisto", detail: "Colocación de textos e imágenes que entrega el cliente.", list: 30, offer: 12 },
  // NUEVO — el briefing ofrece usar banco de imágenes
  { key: "banco_imagenes", cat: "Contenido", name: "Selección de banco de imágenes", detail: "Fotografías de stock elegidas para el rubro.", list: 20, offer: 8 },

  // ─────────── MANTENIMIENTO ───────────
  { key: "mant_basico", cat: "Mantenimiento", name: "Mantenimiento básico", detail: "Backup, monitoreo y actualizaciones.", list: 25, offer: 10, per: "mes" },
  { key: "mant_estandar", cat: "Mantenimiento", name: "Mantenimiento estándar", detail: "Básico + hasta 1 hora/mes de cambios de contenido.", list: 40, offer: 16, per: "mes" },
  { key: "mant_pro", cat: "Mantenimiento", name: "Mantenimiento pro", detail: "Contenido, soporte prioritario y mejoras menores.", list: 75, offer: 30, per: "mes" },

  // ─────────── DOMINIO / HOSTING ───────────
  { key: "dominio", cat: "Dominio y hosting", name: "Configuración de dominio", detail: "DNS, apuntado y verificación del dominio del cliente.", list: 15, offer: 6 },
  { key: "hosting", cat: "Dominio y hosting", name: "Hosting GitHub Pages + SSL", detail: "Incluido en toda cotización. Sin costo mensual.", list: 0, offer: 0 },
];

const byKey = new Map(NOMENCLADOR.map((i) => [i.key, i]));

// ---------- Mapeo opciones del briefing → ítems del nomenclador ----------

function has(body, arrKey, value) {
  const arr = Array.isArray(body && body[arrKey]) ? body[arrKey] : [];
  return arr.includes(value);
}

// Calcula el presupuesto estimado a partir de las respuestas del briefing.
// Devuelve { items, total_offer, total_list, currency, fecha, plazo, plan }.
export function computeBudget(body) {
  const b = body || {};
  const added = new Map(); // key → { item, qty }

  const add = (key, qty = 1) => {
    const item = byKey.get(key);
    if (!item) return;
    const cur = added.get(key);
    if (cur) cur.qty += qty;
    else added.set(key, { item, qty });
  };

  // Base según tipo de sitio
  const tipo = String(b.tipo_sitio || "");
  let baseKey = "base_sitio_1_3"; // default razonable
  if (tipo.includes("Landing")) baseKey = "base_landing";
  else if (tipo.includes("multi-página") || tipo.includes("multi-pagina")) baseKey = "base_multipagina";
  add(baseKey);

  // Secciones con precio propio
  if (has(b, "secciones", "Blog") || has(b, "funcionalidades", "Blog integrado")) add("blog");
  if (has(b, "blog_edicion", "Incluir página de edición y actualización de blog")) add("blog_edicion");
  if (has(b, "precios_edicion", "Incluir página de edición y actualización de precios / paquetes")) add("precios_edicion");

  // Funcionalidades
  if (has(b, "funcionalidades", "Galería / portfolio con imágenes")) add("galeria");
  if (has(b, "funcionalidades", "Reservas / turnos")) add("reservas");
  if (has(b, "funcionalidades", "Botón de pago")) add("boton_pago");
  if (has(b, "funcionalidades", "Mapa de ubicación")) add("mapa");
  if (has(b, "funcionalidades", "Enlaces a redes sociales")) add("redes");
  if (has(b, "funcionalidades", "Estadísticas / Google Analytics")) add("analytics");

  // Cómo quiere ser contactado
  const contacto = String(b.contacto_modo || "");
  if (contacto.includes("Formulario")) add("form_contacto");
  if (contacto.includes("WhatsApp")) add("wa_flotante");

  // Idioma: "Español" solo no suma; cualquier otro idioma/versión extra cotiza
  const idioma = String(b.idioma || "").trim();
  if (idioma && idioma !== "Español") {
    add("multi_idioma", /triling/i.test(idioma) ? 2 : 1);
  }

  // Diseño / contenidos
  if (String(b.logo || "") === "No, necesito que me lo hagan") add("logo_simple");
  if (String(b.textos || "").includes("Necesito que me ayuden a redactarlos")) add("redaccion", 1);
  if (String(b.fotos || "").includes("banco de imágenes") || String(b.fotos || "").includes("banco de imagenes")) add("banco_imagenes");

  // Hosting: siempre incluido (USD 0) para que se vea el valor
  add("hosting", 1);

  const items = [];
  let total_offer = 0;
  let total_list = 0;
  for (const { item, qty } of added.values()) {
    const subtotal_offer = item.offer * qty;
    const subtotal_list = item.list * qty;
    total_offer += subtotal_offer;
    total_list += subtotal_list;
    items.push({
      key: item.key,
      cat: item.cat,
      name: item.name,
      detail: item.detail,
      per: item.per || null,
      qty,
      unit_offer: item.offer,
      unit_list: item.list,
      subtotal_offer,
      subtotal_list,
    });
  }

  return {
    items,
    total_offer,
    total_list,
    currency: "USD",
    fecha: new Date().toISOString(),
    plazo: String(b.plazo || "").trim(),
    plan: String(b.plan || "").trim(),
    cliente: String(b.nombre || "").trim(),
    empresa: String(b.empresa || "").trim(),
    email: String(b.email || "").trim(),
  };
}
