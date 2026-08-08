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
  const ANIMATED_SELECTORS = '.proc-step, .serv-card, .p-card, .svc-card, .legal-card';
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

/* ── 4. CARRUSEL DE TESTIMONIOS ── */
function initTestimonialsCarousel() {
  const carousel = document.querySelector('[data-carousel]');
  if (!carousel) return;

  const track = carousel.querySelector('[data-carousel-track]');
  const slides = [...carousel.querySelectorAll('[data-carousel-slide]')];
  const dotsEl = carousel.querySelector('[data-carousel-dots]');
  const prevBtn = carousel.querySelector('[data-carousel-prev]');
  const nextBtn = carousel.querySelector('[data-carousel-next]');
  if (!track || slides.length === 0) return;

  let current = 0;
  let timer = null;
  const AUTOPLAY_MS = 6000;

  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'testi-dot';
    dot.setAttribute('aria-label', `Testimonio ${i + 1}`);
    dot.addEventListener('click', () => { goTo(i); restart(); });
    dotsEl.appendChild(dot);
    return dot;
  });

  function goTo(index) {
    current = (index + slides.length) % slides.length;
    track.scrollTo({ left: current * track.clientWidth, behavior: 'smooth' });
    slides.forEach((slide, i) => slide.classList.toggle('visible', i === current));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function restart() {
    if (timer) clearInterval(timer);
    if (slides.length > 1) timer = setInterval(next, AUTOPLAY_MS);
  }

  prevBtn.addEventListener('click', () => { prev(); restart(); });
  nextBtn.addEventListener('click', () => { next(); restart(); });

  // Sincroniza dots si el usuario hace swipe en el track
  let scrollTimeout = null;
  track.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const index = Math.round(track.scrollLeft / track.clientWidth);
      goTo(index);
    }, 120);
  });

  window.addEventListener('resize', () => { goTo(current); });
  slides.forEach((slide, i) => slide.classList.toggle('visible', i === 0));
  dots[0]?.classList.add('active');
  restart();
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

    // El campo token_validacion era una "clave" fija hardcodeada en el bundle
    // público — cualquiera la leía con DevTools, así que no aportaba seguridad
    // (mitigación real: honeypot + rate-limit del form). Se envía un valor
    // aleatorio por sesión solo como marcador de tráfico legítimo. Si el Apps
    // Script valida ese valor, hay que actualizarlo allá (no en el cliente).
    const payload = {
      nombre,
      email,
      whatsapp,
      profesion,
      proyecto,
      token_validacion: crypto.randomUUID(),
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
  initTestimonialsCarousel();
  initContactForm();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
