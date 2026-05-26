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
  const ANIMATED_SELECTORS = '.proc-step, .serv-card, .p-card, .t-card';
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* ── Honeypot ── */
    const honeypot = form.querySelector('#hp-website');
    if (honeypot && honeypot.value.trim() !== '') {
      setFormState(btn, note, 'success');
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

    const payload = { nombre, email, whatsapp, rubro, proyecto };

    /* ── Envío a Google Apps Script ──
       Google Apps Script no soporta CORS real desde sitios estáticos.
       Con mode:'no-cors' la respuesta es opaca (no legible), pero si
       fetch no lanza excepción el request llegó correctamente al servidor.
    ── */
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify(payload),
      });

      setFormState(btn, note, 'success');
      resetForm(form);

    } catch (err) {
      console.error('[SHC Digital] Error al enviar formulario:', err);
      setFormState(btn, note, 'error', '⚠ No se pudo enviar. Intentá de nuevo.');
    }
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