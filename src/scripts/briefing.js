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
  const OTHER_UNITS = 27;
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
    { name: 'redes', unit: 'o' },
    { name: 'textos', unit: 'o' },
    { name: 'fotos', unit: 'o' },
    { name: 'logo', unit: 'o' },
    { name: 'colores', unit: 'o' },
    { name: 'estilo', unit: 'o' },
    { name: 'tono', unit: 'o' },
    { name: 'tipo_sitio', unit: 'o' },
    { name: 'secciones', unit: 'o' },
    { name: 'secciones_otras', unit: 'o' },
    { name: 'contacto_modo', unit: 'o' },
    { name: 'cta', unit: 'o' },
    { name: 'funcionalidades', unit: 'o' },
    { name: 'idioma', unit: 'o' },
    { name: 'plan', unit: 'o' },
    { name: 'plazo', unit: 'o' },
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

  /* ── Verificador de disponibilidad de dominio (.ar) ──
     Misma técnica que el panel admin: consulta DNS over HTTPS (dns.google).
     Un dominio .ar libre responde NXDOMAIN (Status 3). whois.nic.ar y
     rdap.nic.ar bloquean requests de origen navegador/CORS, por eso DoH. */
  const domInput = document.getElementById('in-dominio');
  const domTld = document.getElementById('dom-tld');
  const domBtn = document.getElementById('btnCheckDomain');
  const domResult = document.getElementById('domResult');
  let domainStatus = null; // { full, disponible }

  async function checkDomain() {
    if (!domInput || !domTld || !domBtn || !domResult) return;
    const name = domInput.value.trim().toLowerCase();
    const tld = domTld.value;
    if (!name) {
      domResult.textContent = 'Escribí un nombre para verificar su disponibilidad';
      domResult.className = 'dom-result is-error';
      return;
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      domResult.textContent = 'Solo letras, números y guiones';
      domResult.className = 'dom-result is-error';
      return;
    }
    const full = name + tld;
    domBtn.disabled = true;
    domResult.textContent = 'Verificando ' + full + '...';
    domResult.className = 'dom-result is-checking';

    try {
      // Doble chequeo NS + A (como en el panel)
      const [ns, a] = await Promise.all([
        fetch('https://dns.google/resolve?name=' + encodeURIComponent(full) + '&type=NS', { headers: { Accept: 'application/dns-json' } }).then((r) => r.json()),
        fetch('https://dns.google/resolve?name=' + encodeURIComponent(full) + '&type=A', { headers: { Accept: 'application/dns-json' } }).then((r) => r.json()),
      ]);
      const nxdomain = ns.Status === 3;
      const disponible = nxdomain && a.Status === 3;
      domainStatus = { full, disponible };
      domResult.textContent = disponible
        ? '✓ ' + full + ' está DISPONIBLE'
        : '✗ ' + full + ' ya está registrado';
      domResult.className = 'dom-result ' + (disponible ? 'is-ok' : 'is-taken');
    } catch (e) {
      domainStatus = null;
      domResult.textContent = 'No se pudo verificar. Reintentá más tarde.';
      domResult.className = 'dom-result is-error';
    } finally {
      domBtn.disabled = false;
    }
  }

  if (domBtn) domBtn.addEventListener('click', checkDomain);
  if (domInput) domInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); checkDomain(); } });
  if (domTld) domTld.addEventListener('change', () => { if (domInput && domInput.value.trim()) checkDomain(); });

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
    L.push('- Redes sociales: ' + or(val('redes'), '—'));
    L.push('');

    L.push('[3] CONTENIDO Y MARCA');
    L.push('- Textos: ' + or(radio('textos'), 'No especificado'));
    L.push('- Fotos: ' + or(radio('fotos'), 'No especificado'));
    L.push('- Logo: ' + or(radio('logo'), 'No especificado'));
    L.push('- Paleta de colores: ' + or(radio('colores'), 'No especificado'));
    L.push('- Estilo visual: ' + or(radio('estilo'), 'No especificado'));
    L.push('- Tono de voz: ' + or(radio('tono'), 'No especificado'));
    L.push('');

    L.push('[4] ESTRUCTURA Y FUNCIONALIDADES');
    L.push('- Tipo de sitio: ' + or(radio('tipo_sitio'), 'No especificado'));
    L.push('- Páginas / secciones: ' + list(checks('secciones')));
    L.push('- Otras secciones: ' + or(val('secciones_otras'), '—'));
    L.push('- Contacto: ' + or(radio('contacto_modo'), 'No especificado'));
    L.push('- Acción principal (CTA): ' + or(radio('cta'), 'No especificado'));
    L.push('- Funcionalidades extras: ' + list(checks('funcionalidades')));
    L.push('- Idioma: ' + or(radio('idioma'), 'No especificado'));
    L.push('');

    L.push('[5] PLAN Y PLAZOS');
    L.push('- Plan elegido: ' + or(radio('plan'), 'No especificado'));
    L.push('- Plazo: ' + or(radio('plazo'), 'No especificado'));
    const dominioRaw = val('dominio');
    if (domainStatus) {
      L.push('- Dominio: ' + domainStatus.full + ' — ' + (domainStatus.disponible ? 'DISPONIBLE' : 'YA REGISTRADO'));
      if (!domainStatus.disponible) {
        L.push('  (el cliente eligió un dominio ya registrado: sugerí alternativas cercanas)');
      }
    } else {
      L.push('- Dominio: ' + or(dominioRaw, '—'));
    }
    L.push('');

    L.push('[6] NOTAS ADICIONALES');
    L.push(or(val('notas'), '—'));
    L.push('');

    L.push(sep);
    L.push('INSTRUCCIÓN PARA LA IA — LEER CON ATENCIÓN');
    L.push(sep);
    L.push('');
    L.push('Sos un diseñador web senior y desarrollador frontend. Tu tarea es generar');
    L.push('UN SITIO WEB COMPLETO y profesional en una sola pasada, basándote 100% en');
    L.push('el briefing de arriba. No preguntes nada: usá lo que haya y, donde falte');
    L.push('información, tomá decisiones de diseño razonables y coherentes con el rubro.');
    L.push('');
    L.push('FUENTES DE VERDAD (en este orden):');
    L.push('1. El ORQUESTADOR del AI Workspace (archivo ~/GIT/ai-workspace/AGENTS.md +');
    L.push('   sus agents/, rules/, standards/, workflows/ y design-system/) es la');
    L.push('   autoridad principal para TODAS las decisiones técnicas, de diseño y');
    L.push('   buenas prácticas. Seguí su modelo de orquestación, sus estándares');
    L.push('   (naming, CSS con tokens, SEO, accesibilidad WCAG, performance, git)');
    L.push('   y sus workflows antes que cualquier convención genérica.');
    L.push('2. El MCP de CONTEXT7 (servidor context7) para verificar APIs, sintaxis');
    L.push('   y buenas prácticas actuales de las librerías y frameworks que uses,');
    L.push('   en lugar de confiar en la memoria del modelo.');
    L.push('');
    L.push('REQUISITOS DEL ENTREGABLE:');
    L.push('- Sitio único, moderno y profesional, fiel al briefing (rubro, audiencia,');
    L.push('  colores, estilo, tono de voz, secciones pedidas).');
    L.push('- Responsive mobile-first, HTML/CSS/JS de alta calidad, sin frameworks.');
    L.push('- Estructura optimizada para SEO y velocidad; listo para publicar en GitHub Pages.');
    L.push('- Incluí navegación, las secciones pedidas, un formulario de contacto funcional');
    L.push('  y enlaces a WhatsApp y redes sociales indicadas.');
    L.push('- La acción principal (CTA) debe estar destacada y bien visible.');
    L.push('- Textos redactados en el idioma indicado, con el tono de voz elegido.');
    L.push('- Generá el sitio completo de una sola vez, sin pedir confirmaciones.');
    L.push('');

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
      redes: val('redes'),
      textos: radio('textos'),
      fotos: radio('fotos'),
      logo: radio('logo'),
      colores: radio('colores'),
      estilo: radio('estilo'),
      tono: radio('tono'),
      tipo_sitio: radio('tipo_sitio'),
      secciones: checks('secciones'),
      secciones_otras: val('secciones_otras'),
      contacto_modo: radio('contacto_modo'),
      cta: radio('cta'),
      funcionalidades: checks('funcionalidades'),
      idioma: radio('idioma'),
      plan: radio('plan'),
      plazo: radio('plazo'),
      dominio: domainStatus ? domainStatus.full : val('dominio'),
      dominio_disponible: domainStatus ? domainStatus.disponible : null,
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
