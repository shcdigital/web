/**
 * ═══════════════════════════════════════════════════════════
 *  SHC Digital — app.js
 *  Lógica principal del sitio
 *
 *  Módulos:
 *    1. Configuración
 *    2. Scroll suave
 *    3. Animaciones de entrada (IntersectionObserver)
 *    4. Formulario de contacto
 *       · Honeypot anti-bot
 *       · Validación de campos obligatorios
 *       · Validación de formato de email
 *       · Envío async con fetch (POST JSON → Google Apps Script)
 *       · Manejo de estados: loading / success / error
 *       · Protección contra doble submit
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
 *
 * Ejemplo:
 *   'https://script.google.com/macros/s/AKfycb.../exec'
 */
const GOOGLE_SCRIPT_URL = 'REEMPLAZAR_CON_TU_URL_DE_APPS_SCRIPT';


/* ─────────────────────────────────────────────
   2. SCROLL SUAVE
───────────────────────────────────────────── */

/**
 * Intercepta todos los enlaces internos (#hash) y hace
 * scroll suave hasta la sección destino.
 */
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

/**
 * Agrega la clase `.visible` a los elementos animados
 * cuando entran en el viewport. La transición CSS
 * (opacity + transform) está definida en styles.css.
 */
function initScrollAnimations() {
  const ANIMATED_SELECTORS = '.proc-step, .serv-card, .p-card, .t-card';
  const STAGGER_COLUMNS     = 4; // máximo de columnas en el grid más ancho
  const STAGGER_DELAY_MS    = 100;

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

/**
 * Valida el formato básico de un email.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Actualiza el estado visual del botón y la nota de estado.
 * @param {HTMLButtonElement} btn
 * @param {HTMLElement}       note
 * @param {'idle'|'loading'|'success'|'error'} state
 * @param {string} [message]
 */
function setFormState(btn, note, state, message = '') {
  // Limpiar clases anteriores
  btn.classList.remove('is-success');
  note.classList.remove('is-error', 'is-success');

  switch (state) {
    case 'loading':
      btn.textContent = '→ Enviando...';
      btn.disabled    = true;
      note.textContent = '';
      break;

    case 'success':
      btn.textContent = '✓ Enviado';
      btn.disabled    = true;
      btn.classList.add('is-success');
      note.textContent = message || '¡Gracias! Te contactamos en menos de 24hs.';
      note.classList.add('is-success');
      break;

    case 'error':
      btn.textContent = '→ Enviar consulta';
      btn.disabled    = false;
      note.textContent = message || '⚠ Error al enviar. Intentá de nuevo.';
      note.classList.add('is-error');
      break;

    case 'idle':
    default:
      btn.textContent  = '→ Enviar consulta';
      btn.disabled     = false;
      note.textContent = 'Respondemos en <24hs';
      break;
  }
}

/**
 * Limpia todos los campos del formulario.
 * @param {HTMLFormElement} form
 */
function resetForm(form) {
  form.querySelectorAll('.f-input').forEach((input) => {
    input.value = '';
  });
}

/**
 * Inicializa el formulario de contacto:
 *   - Honeypot check
 *   - Validación de campos
 *   - Envío async a Google Apps Script
 *   - Feedback visual al usuario
 */
function initContactForm() {
  const form     = document.getElementById('contactForm');
  const btn      = document.getElementById('f-btn-submit');
  const note     = document.getElementById('f-note');

  if (!form || !btn || !note) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* ── 4a. Honeypot: si el campo oculto tiene valor, es un bot ── */
    const honeypot = form.querySelector('#hp-website');
    if (honeypot && honeypot.value.trim() !== '') {
      // Simular éxito para no alertar al bot
      setFormState(btn, note, 'success', '¡Gracias! Te contactamos en menos de 24hs.');
      return;
    }

    /* ── 4b. Recoger valores por name ── */
    const nombre   = form.querySelector('[name="nombre"]').value.trim();
    const email    = form.querySelector('[name="email"]').value.trim();
    const whatsapp = form.querySelector('[name="whatsapp"]').value.trim();
    const rubro    = form.querySelector('[name="rubro"]').value.trim();
    const proyecto = form.querySelector('[name="proyecto"]').value.trim();

    /* ── 4c. Validación de campos obligatorios ── */
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

    /* ── 4d. Estado de carga — deshabilita el botón ── */
    setFormState(btn, note, 'loading');

    const payload = { nombre, email, whatsapp, rubro, proyecto };

    /* ── 4e. Envío a Google Apps Script ── */
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method:  'POST',
        mode:    'cors',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Éxito
      setFormState(btn, note, 'success');
      resetForm(form);

    } catch (err) {
      console.error('[SHC Digital] Error al enviar formulario:', err);
      setFormState(btn, note, 'error', '⚠ No se pudo enviar. Intentá de nuevo.');
    }
  });
}


/* ─────────────────────────────────────────────
   INIT — punto de entrada
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initScrollAnimations();
  initContactForm();
});
