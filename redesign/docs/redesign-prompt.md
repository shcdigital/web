# PROMPT — Segunda propuesta de diseño para SHC Digital (sitio paralelo)

## TU ROL
Sos un diseñador web senior y creative director. Trabajás sobre un sitio Astro
existente para generar una **SEGUNDA PROPUESTA DE DISEÑO**: mismo contenido,
misma información, mismas funciones y misma identidad de marca, pero con un
diseño visual distinto al actual. El resultado debe ser un sitio paralelo que
comparta identidad con el original pero se sienta como otra pieza de la misma
marca.

---

## 1. LA EMPRESA Y LA IDEA
**SHC Digital** (shcdigital.net.ar) es una empresa argentina de **diseño web
con IA**. Propuesta de valor central:
- Sitios publicados en **GitHub Pages**: hosting gratuito, **sin costos
  mensuales, pago único**, "tu sitio online para siempre".
- Diseño generado con IA, sin plantillas, 100% responsive.
- Entrega promedio en **72 horas**. Dominio propio + SSL + SEO incluidos.
- Código fuente entregado: el cliente es dueño de todo.

Público: profesionales y pequeños negocios (psicólogas, contadores, artesanos,
revistas, nutricionistas…) que nunca tuvieron página web o la evitaban por
costos. El tono es cercano, directo y que da confianza al "no tecnológico".

## 2. IDENTIDAD DE MARCA (INALTERABLE — debe percibirse la misma marca)
- **Logotipo tipográfico**: `SHC.DIGITAL` en Bebas Neue con el **punto del
  "SHC." en rojo**. Es el único logo (no hay isologo/imagen).
- **Paleta** (tokens semánticos, NO cambian):
  - Superficies: crema `#f2ede6`, crema claro `#faf8f4`, negro `#0f0e0c`
    (inversa), tarjeta oscura `#141310`.
  - Texto: negro `#0f0e0c`, gris secundario `#6b6358`, gris muted `#999490`,
    blanco sobre oscuro.
  - **Marca: rojo `#e8321a`** (deep `#d3281a`, dark `#c82a14`).
  - Borde `#d8d2c8`, éxito `#1a7a3a`.
- **Tipografías**: `Bebas Neue` (display, títulos enormes condensados),
  `Barlow` (texto, ligera, peso 300-600), `Space Mono` (etiquetas técnicas,
  "mono", uppercase, letter-spacing).
- **Lenguaje visual actual (a rediseñar, no a copiar)**: estética editorial-
  tipográfica, títulos gigantes en mayúsculas con palabras en **contorno
  (ghost/outline text-stroke)**, labels mono con `//`, chips rojos uppercase,
  números de sección gigantes (01–06), bordes de 1px y grids finos, ticker
  rojo animado, layouts con columnas de lado oscuro (inversa), micro-
  animaciones de entrada con IntersectionObserver, scroll suave.
- **Tono de voz**: español rioplatense ("vos", "elegí", "contanos"),
  mayúsculas tipográficas, directo, sin tecnicismos ("De tecnología no
  entiendo nada" es el cliente típico).

## 3. ESTRUCTURA Y CONTENIDO DEL SITIO (el contenido NO se modifica)
### / (Home, secciones en orden):
1. **Hero**: tag `// diseño web con inteligencia artificial`, H1 "TU SITIO
   WEB" (con palabra outline y "WEB" en rojo), "Sin costos mensuales. Para
   siempre.", descripción con GitHub Pages, 2 CTAs (`→ Quiero mi sitio` a
   `/#contacto`, `Ver proceso` a `/#proceso`). Panel de stats: `$0 hosting
   mensual`, `72hs entrega promedio`, `1× pago único`, y el muted
   "SSL · HTTPS · DOMINIO PROPIO — incluido en todos los planes".
2. **Ticker** animado: GitHub Pages · Diseño con IA · Pago único · Sin
   suscripciones · Dominio propio · SSL incluido · 100% responsive · Código
   tuyo · 72hs entrega.
3. **Proceso** (4 pasos): 01 Briefing / 02 Diseño con IA / 03 Revisión /
   04 Deploy en GitHub Pages.
4. **Servicios** (6 cards): Diseño a medida con IA, GitHub Pages gratuito,
   Dominio propio + SSL, 100% responsive, Código fuente entregado, SEO y
   analítica.
5. **Planes** (3 cards sobre fondo negro, "Pro — más elegido" destacado):
   Starter (1 página), Pro (5 secciones, hot), Business (multi-página).
   CTA de cada una → `/#contacto`.
6. **Testimonios** (5, carrusel con autoplay 6s, flechas y dots).
7. **Contacto**: formulario (nombre, email, WhatsApp con prefijo
   internacional, profesión, proyecto) + panel "POR QUÉ ELEGIRNOS" con 4
   razones ($0/MES, 72HS, 100%, IA).

### /servicios (página): header + 6 servicios especializados (Registro de
dominio, Diseño web con IA, Cloudflare hardening, GitHub Pages con link a
`/github-pages`, Formularios + alertas vía APIs, Core Web Vitals) + CTA final.

### /terminos: artículos legales (objeto, responsabilidad, deslinde,
seguridad, jurisdicción, anexo con link a /github-pages).

### /github-pages: anexo legal sobre uso comercial de GitHub Pages (5
artículos con listas y links oficiales).

### /briefing (PÁGINA AISLADA, standalone — no usa nav/footer): formulario
largo de 6 secciones para clientes: 01 Datos de contacto, 02 Sobre tu
negocio, 03 Contenido y marca (radio groups de colores, estilos, tono),
04 Estructura y funcionalidades, 05 Plan y plazos (con **verificador de
disponibilidad de dominio** vía DNS), 06 Notas. Incluye: barra de progreso,
subida de logo y fotos con previews, honeypot anti-spam, botón
`→ ENVIAR BRIEFING` con nota "llega a shcdigitalsolutions@gmail.com", toast
de éxito. Envía al worker `briefing-api` (Cloudflare, con rate-limit).

### /nomenclador: documento interno de cotización (noindex, no enlazado en
ningún menú).

### Footer (todas las páginas): `SHC.DIGITAL` + © año + links Servicios /
Términos / Contacto.

## 4. FUNCIONALIDADES (TODAS DEBEN SEGUIR FUNCIONANDO IGUAL)
- **Formulario de contacto**: envío a Google Apps Script (POST no-cors),
  honeypot invisible, anti-bot (tiempo mínimo de interacción, cooldown 60s
  con mensaje de espera), validaciones (nombre/email/formato), estados del
  botón (Enviando / ✓ Enviado / error), reset del form.
- **Carrusel de testimonios**: scroll-snap, autoplay 6s que se reinicia con
  interacción, dots generados dinámicamente, swipe sincronizado.
- **Menú móvil**: toggle con aria-expanded, cierra al elegir enlace.
- **Scroll suave** para anclas `#` y **animaciones de entrada** al hacer
  scroll (clase `.visible`, stagger).
- **Briefing**: progreso en %, check de dominio DNS (DoH), previews de
  uploads (logo + hasta 3 fotos), validación, envío con toast.
- **SEO completo**: title/description por página, Open Graph, Twitter cards,
  canonical, sitemap.xml, robots.txt, security.txt, favicon, theme-color.
- **Accesibilidad**: aria-labels, focus-visible, `prefers-reduced-motion`,
  navegación por teclado.
- **Responsive**: mobile-first, breakpoint ~960px.

## 5. RESTRICCIONES TÉCNICAS (ARQUITECTURA ASTRO — NO ROMPER)
- **Astro 7**, build 100% estático a GitHub Pages con dominio custom
  (`site: https://shcdigital.net.ar`, `base: "/"`), cero JS por defecto.
- **Design system por tokens**: colores/tipografías SOLO vía variables CSS
  (`var(--token)`), fuente única en `brand/tokens.json` que genera
  `src/styles/brand.css` (script `npm run sync:brand`). No hardcodear colores.
- **CSP estricta**: `script-src 'self'`, `style-src 'self'` — por eso
  `build.inlineStylesheets: "never"` y `assetsInlineLimit: 0` (nada inline).
  Mantener los hosts actuales de la CSP (fonts.googleapis/gstatic,
  script.google.com, briefing-api.shcdigital.net.ar, cloudflareinsights,
  dns.google).
- **Estructura de componentes** a respetar: `src/layouts/Layout.astro`
  (head SEO + CSP + nav/footer + carga de app.js), `src/components/ui/`
  (Navbar, Hero, Footer, ContactForm), `src/data/*.json` (planes,
  testimonios), `src/scripts/` (app.js, briefing.js), `src/styles/`
  (brand.css, global.css, pages.css, briefing.css).
- La página `/briefing` es **standalone** (propio CSS y JS, sin nav/footer).
- Deploy automático vía GitHub Actions (workflow existente, no tocar).
- Sin dependencias nuevas innecesarias: solo Astro + vanilla JS.

## 6. QUÉ SE PIDE (EL ENCARGO)
Diseñar y desarrollar una **segunda propuesta visual completa** del sitio,
distinta a la actual:

1. **Mismo contenido, texto, datos, rutas, funciones y arquitectura**.
2. **Nueva dirección de diseño** que se sienta como otra pieza de SHC: podés
   cambiar composición, jerarquías, layout de secciones, fondo dominante
   (ej. oscuro, crema puro, grid más gráfico), tratamiento tipográfico,
   forma de presentar planes/testimonios/stats, navegación, footer, etc.
   Debe verse claramente "diferente" a la versión actual pero ser
   inconfundiblemente SHC Digital (colores, tipografías, el punto rojo,
   la voz). Proponé una dirección con identidad propia (ej: "industrial
   tech", "editorial suave", "brutalismo tipográfico", "terminal/CRT",
   "boletín editorial"… lo que mejor defienda la marca), y fundamentá.
3. **Preservar**: mensajes clave ($0 hosting, pago único, 72hs, código
   tuyo), CTAs, todo el SEO, la accesibilidad y la performance.
4. **Entregable**: sitio paralelo completo funcionando (componentes, estilos,
   scripts si hace falta), listo para compilar con `npm run build` y
   desplegar por el mismo pipeline. Se puede ubicar en carpeta/branch
   paralela sin tocar la versión actual.

## 7. CRITERIOS DE CALIDAD
- Lighthouse ≥ 95 en las 4 métricas; sin JS en el render inicial crítico.
- Accesibilidad AA: foco visible, aria correcta, reduced-motion.
- Mobile perfecto desde 320px.
- Cero contenido inventado: textos, planes, testimonios y datos se copian
  tal cual de la versión actual.
- El diseño debe mantener coherencia entre todas las páginas (incluida la
  experiencia del /briefing, que puede integrarse mejor si querés).

Entregá: fundamentación de la dirección elegida, mapa de componentes,
archivos del sitio paralelo y verificación de build.
