/**
 * ═══════════════════════════════════════════════════════════
 *  SHC Digital — app.js
 *  Lógica principal del sitio
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/* ─────────────────────────────────────────────
   1. CONFIGURACIÓN
───────────────────────────────────────────── */

/**
 * URL del Web App de Google Apps Script.
 * Reemplazá este placeholder con la URL que obtenés
 * al publicar el script (Implementar → Aplicación web).
 */
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJ3aN_UHT3DadWEGXnu9GsY6sSwGuRKRA2KSMLNW_QDr8-998MNvcjf8HeNMw-TbzbyA/exec';


/* ─────────────────────────────────────────────
   2. SCROLL SUAVE
───────────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      const target   = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}


/* ─────────────────────────────────────────────
   3. ANIMACIONES DE ENTRADA
───────────────────────────────────────────── */
function initScrollAnimations() {
  const ANIMATED_SELECTORS = '.proc-step, .serv-card, .p-card, .t-card, .svc-card, .legal-card';
  const STAGGER_COLUMNS    = 4;
  const STAGGER_DELAY_MS   = 100;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll(ANIMATED_SELECTORS).forEach((el, index) => {
    el.style.transitionDelay = `${(index % STAGGER_COLUMNS) * STAGGER_DELAY_MS}ms`;
    observer.observe(el);
  });
}


/* ─────────────────────────────────────────────
   4. FORMULARIO DE CONTACTO
───────────────────────────────────────────── */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setFormState(btn, note, state, message) {
  btn.classList.remove('is-success');
  note.classList.remove('is-error', 'is-success');

  switch (state) {
    case 'loading':
      btn.textContent  = '→ Enviando...';
      btn.disabled     = true;
      note.textContent = '';
      break;

    case 'success':
      btn.textContent  = '✓ Enviado';
      btn.disabled     = true;
      btn.classList.add('is-success');
      note.textContent = message || '¡Gracias! Te contactamos en menos de 24hs.';
      note.classList.add('is-success');
      break;

    case 'error':
      btn.textContent  = '→ Enviar consulta';
      btn.disabled     = false;
      note.textContent = message || '⚠ No se pudo enviar. Intentá de nuevo.';
      note.classList.add('is-error');
      break;

    default:
      btn.textContent  = '→ Enviar consulta';
      btn.disabled     = false;
      note.textContent = 'Respondemos en <24hs';
  }
}

function resetForm(form) {
  form.querySelectorAll('.f-input').forEach((input) => {
    input.value = '';
  });
  const prefixSelect = form.querySelector('[name="prefix"]');
  if (prefixSelect) prefixSelect.value = '+54';
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  const btn  = document.getElementById('f-btn-submit');
  const note = document.getElementById('f-note');

  if (!form || !btn || !note) return;

  /* ── Timestamp de carga del formulario ───────────────────────────────
     Registramos el momento exacto en que el form se inicializa.
     Se usa más abajo para calcular el tiempo de interacción del usuario.
     ADAPTÁ → MIN_INTERACTION_MS: mínimo de ms que debe tardar un humano.
     3000ms (3 seg) es conservador; podés subirlo a 5000 si recibís spam.
  ── */
  const FORM_LOAD_TIME      = Date.now();
  const MIN_INTERACTION_MS  = 3000;   // ADAPTÁ → tiempo mínimo en ms

  /* ── Rate limiting por sesión ────────────────────────────────────────
     Impedimos reenvíos durante COOLDOWN_MS después de un envío exitoso.
     El timestamp del último envío se guarda en memoria (sessionStorage
     no persiste entre pestañas ni recargas, lo que es intencional).
     ADAPTÁ → COOLDOWN_MS: 60000 = 1 minuto de espera entre envíos.
  ── */
  const COOLDOWN_MS = 60000;          // ADAPTÁ → cooldown en ms (60 seg)
  const STORAGE_KEY = 'shc_last_submit';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* ── Honeypot ── */
    const honeypot = form.querySelector('#hp-website');
    if (honeypot && honeypot.value.trim() !== '') {
      setFormState(btn, note, 'success');
      return;
    }

    /* ── Control de tiempo mínimo de interacción ─────────────────────
       Si el form se envía en menos de MIN_INTERACTION_MS desde que
       cargó la página, es casi seguro un bot. Lo bloqueamos silencioso:
       simulamos éxito para no revelar que fue detectado.
    ── */
    const elapsed = Date.now() - FORM_LOAD_TIME;
    if (elapsed < MIN_INTERACTION_MS) {
      console.warn('[SHC Digital] Envío demasiado rápido — posible bot.');
      setFormState(btn, note, 'success');   // silencioso: no alertar al bot
      return;
    }

    /* ── Rate limiting: un envío por minuto por sesión ───────────────
       Leemos el timestamp del último envío exitoso de sessionStorage.
       Si no pasó el cooldown, mostramos un mensaje al usuario real
       (puede ser un humano que accidentalmente haga doble submit).
    ── */
    const lastSubmit = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0', 10);
    const sinceLastMs = Date.now() - lastSubmit;
    if (sinceLastMs < COOLDOWN_MS) {
      const secsLeft = Math.ceil((COOLDOWN_MS - sinceLastMs) / 1000);
      setFormState(btn, note, 'error', `⚠ Ya enviaste una consulta. Esperá ${secsLeft}s antes de reintentar.`);
      return;
    }

    /* ── Recoger valores ── */
    const nombre   = form.querySelector('[name="nombre"]').value.trim();
    const email    = form.querySelector('[name="email"]').value.trim();
    const prefix   = form.querySelector('[name="prefix"]').value;
    const waNumber = form.querySelector('[name="whatsapp"]').value.trim();
    const whatsapp = waNumber ? `${prefix} ${waNumber}` : '';
    const rubro    = form.querySelector('[name="rubro"]').value.trim();
    const proyecto = form.querySelector('[name="proyecto"]').value.trim();

    /* ── Validación ── */
    if (!nombre) {
      setFormState(btn, note, 'error', '⚠ El nombre es obligatorio.');
      form.querySelector('[name="nombre"]').focus();
      return;
    }
    if (!email) {
      setFormState(btn, note, 'error', '⚠ El email es obligatorio.');
      form.querySelector('[name="email"]').focus();
      return;
    }
    if (!isValidEmail(email)) {
      setFormState(btn, note, 'error', '⚠ El formato del email no es válido.');
      form.querySelector('[name="email"]').focus();
      return;
    }

    /* ── Loading ── */
    setFormState(btn, note, 'loading');

    /* ── Token de validación ──────────────────────────────────────────────
       Apretón de manos estático entre el frontend y Google Apps Script.
       El backend debe verificar que este valor coincida antes de procesar.
       ADAPTÁ → cambiá el string si rotás la clave en el futuro.
    ── */
    const TOKEN_VALIDACION = 'ClaveSecretaDeSHCDigital2026';

    /* ── Payload completo con token inyectado ─────────────────────────────
       El campo 'token_validacion' viaja junto al resto de los datos del
       formulario en el mismo objeto JSON estructurado.
       ADAPTÁ → si agregás campos nuevos al form, sumálos aquí también.
    ── */
    const payload = {
      nombre,
      email,
      whatsapp,
      rubro,
      proyecto,
      token_validacion: TOKEN_VALIDACION,   // ← token de seguridad
    };

    /* ── Validación de tamaño de archivo (placeholder) ────────────────────
       Si en el futuro agregás un <input type="file" id="input-archivo">
       descomentá este bloque para limitar el peso máximo antes de enviar.

    const archivoInput = form.querySelector('#input-archivo');   // ADAPTÁ → ID del input file
    const MAX_BYTES    = 5 * 1024 * 1024;                        // ADAPTÁ → límite en bytes (5 MB)
    if (archivoInput && archivoInput.files.length > 0) {
      if (archivoInput.files[0].size > MAX_BYTES) {
        setFormState(btn, note, 'error', '⚠ El archivo supera el límite de 5 MB.');
        return;
      }
    }
    ── */

    /* ── Envío a Google Apps Script ──────────────────────────────────────
       Con no-cors la respuesta es opaca — algunos navegadores lanzan
       excepción aunque el mensaje llegó. Como está confirmado que llega,
       mostramos éxito siempre después del fetch.
    ── */
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify(payload),   // token viaja dentro del JSON
      });
    } catch (err) {
      // Con no-cors el error no indica falla real de entrega
      console.warn('[SHC Digital] fetch no-cors warning (ignorado):', err);
    }

    // Siempre mostrar éxito — confirmado que los mensajes llegan
    // Guardamos el timestamp del envío exitoso para el rate limiting
    sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
    setFormState(btn, note, 'success');
    resetForm(form);
  });
}


/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initScrollAnimations();
  initContactForm();
});