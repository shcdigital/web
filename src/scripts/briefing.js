/**
 * SHC Digital — briefing.js
 * Lógica de la página Briefing (página aislada).
 * Port del script inline original a módulo ES.
 */

(function () {
  'use strict';

  const form = document.getElementById('briefingForm');
  const btnSend = document.getElementById('btnSend');
  const bNote = document.getElementById('bNote');
  const toast = document.getElementById('bToast');
  const progressFill = document.getElementById('progressFill');
  const progressPct = document.getElementById('progressPct');

  if (!form || !btnSend || !bNote || !toast || !progressFill || !progressPct) return;

  const API_ENDPOINT = 'https://briefing-api.shcdigital.net.ar/send';

  function val(name) {
    const el = form.querySelector('[name="' + name + '"]');
    return el ? el.value.trim() : '';
  }
  function radio(name) {
    const el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function checks(name) {
    return Array.prototype.map.call(
      form.querySelectorAll('input[name="' + name + '"]:checked'),
      (c) => c.value
    );
  }
  function list(items) {
    return items.length ? items.join(', ') : 'No especificado';
  }
  function or(value, fallback) {
    const v = value.trim();
    return v ? v : fallback;
  }

  /* ── Barra de progreso ── */
  const S1_UNITS = 6;
  const S1_WEIGHT = 40;
  const OTHER_UNITS = 23;
  const OTHER_WEIGHT = 60;

  const PROGRESS_FIELDS = [
    { name: 'nombre', unit: 's1' },
    { name: 'empresa', unit: 's1' },
    { name: 'rubro', unit: 's1' },
    { name: 'email', unit: 's1' },
    { name: 'whatsapp', unit: 's1' },
    { name: 'ciudad', unit: 's1' },
    { name: 'que_haces', unit: 'o' },
    { name: 'audiencia', unit: 'o' },
    { name: 'valor', unit: 'o' },
    { name: 'diferencial', unit: 'o' },
    { name: 'objetivo', unit: 'o' },
    { name: 'competencia', unit: 'o' },
    { name: 'referencias', unit: 'o' },
    { name: 'textos', unit: 'o' },
    { name: 'fotos', unit: 'o' },
    { name: 'logo', unit: 'o' },
    { name: 'colores', unit: 'o' },
    { name: 'estilo', unit: 'o' },
    { name: 'tipo_sitio', unit: 'o' },
    { name: 'secciones', unit: 'o' },
    { name: 'secciones_otras', unit: 'o' },
    { name: 'contacto_modo', unit: 'o' },
    { name: 'funcionalidades', unit: 'o' },
    { name: 'idioma', unit: 'o' },
    { name: 'plan', unit: 'o' },
    { name: 'plazo', unit: 'o' },
    { name: 'presupuesto', unit: 'o' },
    { name: 'dominio', unit: 'o' },
    { name: 'notas', unit: 'o' },
  ];

  function isFieldFilled(name) {
    const els = form.querySelectorAll('[name="' + name + '"]');
    if (!els.length) return false;
    const type = els[0].type;
    if (type === 'radio' || type === 'checkbox') {
      for (let i = 0; i < els.length; i++) if (els[i].checked) return true;
      return false;
    }
    return els[0].value.trim() !== '';
  }

  function updateProgress() {
    let s1 = 0;
    let other = 0;
    PROGRESS_FIELDS.forEach((f) => {
      if (!isFieldFilled(f.name)) return;
      if (f.unit === 's1') s1++;
      else other++;
    });
    const pct = Math.min(100, Math.round((s1 / S1_UNITS) * S1_WEIGHT + (other / OTHER_UNITS) * OTHER_WEIGHT));
    progressFill.style.width = pct + '%';
    progressPct.textContent = pct + '%';
  }
  form.addEventListener('input', updateProgress);
  form.addEventListener('change', updateProgress);

  /* ── Validación ── */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  function setNote(msg, state) {
    bNote.textContent = msg;
    bNote.classList.remove('is-success', 'is-error');
    if (state) bNote.classList.add(state);
  }

  /* ── Construir resumen listo para la IA ── */
  function buildPrompt() {
    const L = [];
    const sep = '═══════════════════════════════════════════════════════════';
    L.push(sep);
    L.push('  BRIEFING SHC DIGITAL — DISEÑO DE SITIO WEB CON IA (ONESHOT)');
    L.push(sep);
    L.push('');

    L.push('[1] DATOS DEL CLIENTE');
    L.push('- Nombre y apellido: ' + or(val('nombre'), '—'));
    L.push('- Empresa / Marca: ' + or(val('empresa'), '—'));
    L.push('- Rubro / Profesión: ' + or(val('rubro'), '—'));
    L.push('- Email: ' + or(val('email'), '—'));
    L.push('- WhatsApp: ' + or(val('whatsapp'), '—'));
    L.push('- Ciudad / País: ' + or(val('ciudad'), '—'));
    L.push('');

    L.push('[2] SOBRE EL NEGOCIO');
    L.push('- ¿A qué se dedica?: ' + or(val('que_haces'), '—'));
    L.push('- Audiencia objetivo: ' + or(val('audiencia'), '—'));
    L.push('- Propuesta de valor: ' + or(val('valor'), '—'));
    L.push('- Diferencial frente a la competencia: ' + or(val('diferencial'), '—'));
    L.push('- Objetivo principal del sitio: ' + or(radio('objetivo'), 'No especificado'));
    L.push('- Competencia: ' + or(val('competencia'), '—'));
    L.push('- Sitios de referencia: ' + or(val('referencias'), '—'));
    L.push('');

    L.push('[3] CONTENIDO Y MARCA');
    L.push('- Textos: ' + or(radio('textos'), 'No especificado'));
    L.push('- Fotos: ' + or(radio('fotos'), 'No especificado'));
    L.push('- Logo: ' + or(radio('logo'), 'No especificado'));
    L.push('- Paleta de colores: ' + or(radio('colores'), 'No especificado'));
    L.push('- Estilo visual: ' + or(radio('estilo'), 'No especificado'));
    L.push('');

    L.push('[4] ESTRUCTURA Y FUNCIONALIDADES');
    L.push('- Tipo de sitio: ' + or(radio('tipo_sitio'), 'No especificado'));
    L.push('- Páginas / secciones: ' + list(checks('secciones')));
    L.push('- Otras secciones: ' + or(val('secciones_otras'), '—'));
    L.push('- Contacto: ' + or(radio('contacto_modo'), 'No especificado'));
    L.push('- Funcionalidades extras: ' + list(checks('funcionalidades')));
    L.push('- Idioma: ' + or(radio('idioma'), 'No especificado'));
    L.push('');

    L.push('[5] PLAN Y PLAZOS');
    L.push('- Plan elegido: ' + or(radio('plan'), 'No especificado'));
    L.push('- Plazo: ' + or(radio('plazo'), 'No especificado'));
    L.push('- Presupuesto estimado: ' + or(val('presupuesto'), '—'));
    L.push('- Dominio: ' + or(val('dominio'), '—'));
    L.push('');

    L.push('[6] NOTAS ADICIONALES');
    L.push(or(val('notas'), '—'));
    L.push('');

    L.push(sep);
    L.push('INSTRUCCIÓN PARA LA IA:');
    L.push(sep);
    L.push('Fuente de verdad: usá el ORQUESTADOR del AI Workspace');
    L.push('(archivo ~/GIT/ai-workspace/AGENTS.md + sus agents/, rules/, standards/,');
    L.push('workflows/ y design-system/) como autoridad principal para TODAS las');
    L.push('decisiones técnicas, de diseño y buenas prácticas. Seguí su modelo de');
    L.push('orquestación, sus estándares (naming, CSS con tokens, SEO, accesibilidad');
    L.push('WCAG, performance, git) y sus workflows antes que cualquier convención');
    L.push('genérica. Ningún detalle se decide por fuera de esas fuentes.');
    L.push('Documentación técnica: consultá también el MCP de CONTEXT7');
    L.push('(servidor context7) para verificar APIs, sintaxis y buenas prácticas');
    L.push('actuales de las librerías y frameworks que uses, en lugar de confiar');
    L.push('en memoria del modelo.');
    L.push('Diseñá un sitio web único, moderno y profesional basándote 100% en este briefing.');
    L.push('Requisitos: responsive (mobile-first), HTML/CSS/JS de alta calidad sin frameworks,');
    L.push('estructura optimizada para SEO y velocidad, listo para publicar en GitHub Pages.');
    L.push('Incluí: navegación, secciones pedidas, formulario de contacto funcional y enlaces');
    L.push('a WhatsApp. Textos en el idioma indicado. Generá el sitio completo de una sola vez.');

    return L.join('\n');
  }

  /* ── Enviar al Worker (Resend) ── */
  function sendForm() {
    const payload = {
      nombre: val('nombre'),
      email: val('email'),
      whatsapp: val('whatsapp'),
      empresa: val('empresa'),
      rubro: val('rubro'),
      ciudad: val('ciudad'),
      que_haces: val('que_haces'),
      audiencia: val('audiencia'),
      valor: val('valor'),
      diferencial: val('diferencial'),
      objetivo: radio('objetivo'),
      competencia: val('competencia'),
      referencias: val('referencias'),
      textos: radio('textos'),
      fotos: radio('fotos'),
      logo: radio('logo'),
      colores: radio('colores'),
      estilo: radio('estilo'),
      tipo_sitio: radio('tipo_sitio'),
      secciones: checks('secciones'),
      secciones_otras: val('secciones_otras'),
      contacto_modo: radio('contacto_modo'),
      funcionalidades: checks('funcionalidades'),
      idioma: radio('idioma'),
      plan: radio('plan'),
      plazo: radio('plazo'),
      presupuesto: val('presupuesto'),
      dominio: val('dominio'),
      notas: val('notas'),
      subject: 'Nuevo briefing web — ' + (val('nombre') || 'sin nombre'),
      briefing_prompt: buildPrompt(),
    };

    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /* ── Globo de éxito y redirección ── */
  function showSuccessToast() {
    const TOAST_MS = 3200;
    const REDIRECT_MS = 3900;
    toast.classList.remove('fade');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('fade');
    }, TOAST_MS);
    setTimeout(() => {
      window.location.href = 'https://shcdigital.net.ar';
    }, REDIRECT_MS);
  }

  /* ── Submit ── */
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const hp = form.querySelector('#hp-web');
    if (hp && hp.value.trim() !== '') { setNote('✓ Listo', 'is-success'); return; }

    const nombre = val('nombre');
    const email = val('email');

    if (!nombre) { setNote('⚠ El nombre y apellido es obligatorio.', 'is-error'); return; }
    if (!email) { setNote('⚠ El email es obligatorio.', 'is-error'); return; }
    if (!isValidEmail(email)) { setNote('⚠ El formato del email no es válido.', 'is-error'); return; }

    btnSend.disabled = true;
    btnSend.textContent = '→ ENVIANDO...';
    setNote('Enviando tu briefing...', null);

    sendForm()
      .then((res) => res.json().catch(() => ({})).then((data) => ({ res, data })))
      .then((result) => {
        if (!result.res.ok) {
          throw new Error(result.data && result.data.error ? result.data.error : 'Error del servidor');
        }
        btnSend.textContent = '✓ ENVIADO';
        setNote('', 'is-success');
        showSuccessToast();
      })
      .catch((err) => {
        btnSend.disabled = false;
        btnSend.textContent = '→ ENVIAR BRIEFING';
        setNote('⚠ No se pudo enviar: ' + (err && err.message ? err.message : 'error de red') + '. Reintentá.', 'is-error');
      });
  });

  updateProgress();
})();
