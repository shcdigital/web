/**
 * ═══════════════════════════════════════════════════════════
 *  SHC Digital — app.js
 *  Lógica principal del sitio (port del app.js original).
 *  Se importa desde Layout.astro como módulo.
 * ═══════════════════════════════════════════════════════════
 */

/* ── 1. CONFIGURACIÓN ── */
const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbx6ztEHyXH-q6XAYLrruDCD3lAcS2Jf0OHADsIcykl29xJro4azqtCiUh9L0FApDCENag/exec';

/* ── 2. SCROLL SUAVE ── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (!targetId) return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ── 3. ANIMACIONES DE ENTRADA ── */
function initScrollAnimations() {
  const ANIMATED_SELECTORS = '.proc-step, .serv-card, .p-card, .t-card, .svc-card, .legal-card';
  const STAGGER_COLUMNS = 4;
  const STAGGER_DELAY_MS = 100;

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

/* ── 4. FORMULARIO DE CONTACTO ── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setFormState(btn, note, state, message) {
  btn.classList.remove('is-success');
  note.classList.remove('is-error', 'is-success');

  switch (state) {
    case 'loading':
      btn.textContent = '→ Enviando...';
      btn.disabled = true;
      note.textContent = '';
      break;
    case 'success':
      btn.textContent = '✓ Enviado';
      btn.disabled = true;
      btn.classList.add('is-success');
      note.textContent = message || '¡Gracias! Te contactamos en menos de 24hs.';
      note.classList.add('is-success');
      break;
    case 'error':
      btn.textContent = '→ Enviar consulta';
      btn.disabled = false;
      note.textContent = message || '⚠ No se pudo enviar. Intentá de nuevo.';
      note.classList.add('is-error');
      break;
    default:
      btn.textContent = '→ Enviar consulta';
      btn.disabled = false;
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
  const btn = document.getElementById('f-btn-submit');
  const note = document.getElementById('f-note');

  if (!form || !btn || !note) return;

  const FORM_LOAD_TIME = Date.now();
  const MIN_INTERACTION_MS = 3000;
  const COOLDOWN_MS = 60000;
  const STORAGE_KEY = 'shc_last_submit';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const honeypot = form.querySelector('#hp-website');
    if (honeypot && honeypot.value.trim() !== '') {
      setFormState(btn, note, 'success');
      return;
    }

    const elapsed = Date.now() - FORM_LOAD_TIME;
    if (elapsed < MIN_INTERACTION_MS) {
      console.warn('[SHC Digital] Envío demasiado rápido — posible bot.');
      setFormState(btn, note, 'success');
      return;
    }

    const lastSubmit = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0', 10);
    const sinceLastMs = Date.now() - lastSubmit;
    if (sinceLastMs < COOLDOWN_MS) {
      const secsLeft = Math.ceil((COOLDOWN_MS - sinceLastMs) / 1000);
      setFormState(btn, note, 'error', `⚠ Ya enviaste una consulta. Esperá ${secsLeft}s antes de reintentar.`);
      return;
    }

    const nombre = form.querySelector('[name="nombre"]').value.trim();
    const email = form.querySelector('[name="email"]').value.trim();
    const prefix = form.querySelector('[name="prefix"]').value;
    const waNumber = form.querySelector('[name="whatsapp"]').value.trim();
    const whatsapp = waNumber ? `${prefix} ${waNumber}` : '';
    const profesionInput = form.querySelector('[name="profesion"]') || form.querySelector('[name="rubro"]');
    const profesion = profesionInput ? profesionInput.value.trim() : '';
    const proyecto = form.querySelector('[name="proyecto"]').value.trim();

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

    setFormState(btn, note, 'loading');

    const TOKEN_VALIDACION = 'ClaveSecretaDeSHCDigital2026';
    const payload = {
      nombre,
      email,
      whatsapp,
      profesion,
      proyecto,
      token_validacion: TOKEN_VALIDACION,
    };

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('[SHC Digital] fetch no-cors warning (ignorado):', err);
    }

    sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
    setFormState(btn, note, 'success');
    resetForm(form);
  });
}

/* ── INIT ── */
function init() {
  initSmoothScroll();
  initScrollAnimations();
  initContactForm();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
