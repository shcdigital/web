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

  /* Redes sociales: devuelve [{ red, usuario }] para las marcadas,
     emparejando cada checkbox con su campo de usuario (red_user_*). */
  function redesConUsuarios() {
    const map = {
      'Instagram': 'red_user_instagram',
      'X (Twitter)': 'red_user_x',
      'Facebook': 'red_user_facebook',
      'LinkedIn': 'red_user_linkedin',
    };
    const out = [];
    form.querySelectorAll('input[name="redes"]:checked').forEach((c) => {
      const field = map[c.value];
      const usr = field ? val(field) : '';
      out.push({ red: c.value, usuario: usr });
    });
    return out;
  }
  function list(items) {
    return items.length ? items.join(', ') : 'No especificado';
  }

  /* ── Barra de progreso ── */
  const S1_UNITS = 6;
  const S1_WEIGHT = 40;
  const OTHER_UNITS = 28;
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
    { name: 'redes_otras', unit: 'o' },
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

  /* ── Subida de archivos (logo / fotos) ──
     El cliente puede adjuntar su logo (1 archivo) y hasta 3 fotos cuando
     responda que los tiene. Los archivos viajan en base64 en el payload y el
     Worker los adjunta al mail. Las fotos se acumulan (el input file nativo
     no suma selecciones, así que mantenemos la lista y un preview propio). */
  const MAX_FOTOS = 3;
  const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB por archivo
  let logoFile = null;   // { name, type, data }
  let fotosFiles = [];   // [{ name, type, data }]

  function toggleUpload(elId, radioName, valuesToShow) {
    const el = document.getElementById(elId);
    if (!el) return;
    const show = valuesToShow.includes(radio(radioName));
    el.hidden = !show;
    if (!show) {
      const file = el.querySelector('input[type="file"]');
      if (file) file.value = '';
      if (elId === 'logo-upload') { logoFile = null; renderLogoPreview(); }
      if (elId === 'fotos-upload') { fotosFiles = []; renderFotosPreviews(); }
    }
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result).split(',')[1] || '' });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function dataUrlOf(item) {
    return 'data:' + (item.type || 'image/*') + ';base64,' + item.data;
  }

  function renderLogoPreview() {
    const previews = document.getElementById('logo-previews');
    if (!previews) return;
    if (!logoFile) { previews.hidden = true; previews.innerHTML = ''; return; }
    previews.hidden = false;
    previews.innerHTML = '';
    const tile = document.createElement('div');
    tile.className = 'up-preview';
    const img = document.createElement('img');
    img.src = dataUrlOf(logoFile);
    img.alt = logoFile.name;
    const meta = document.createElement('div');
    meta.className = 'up-meta';
    const name = document.createElement('span');
    name.className = 'up-name';
    name.textContent = logoFile.name;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'up-remove';
    rm.setAttribute('aria-label', 'Quitar logo');
    rm.textContent = '✕';
    rm.addEventListener('click', () => {
      logoFile = null;
      const input = document.querySelector('#logo-upload input[type="file"]');
      if (input) input.value = '';
      renderLogoPreview();
    });
    meta.appendChild(name);
    meta.appendChild(rm);
    tile.appendChild(img);
    tile.appendChild(meta);
    previews.appendChild(tile);
  }

  function renderFotosPreviews() {
    const previews = document.getElementById('fotos-previews');
    if (!previews) return;
    if (!fotosFiles.length) { previews.hidden = true; previews.innerHTML = ''; return; }
    previews.hidden = false;
    previews.innerHTML = '';
    fotosFiles.forEach((item, idx) => {
      const tile = document.createElement('div');
      tile.className = 'up-preview';
      const img = document.createElement('img');
      img.src = dataUrlOf(item);
      img.alt = item.name;
      const meta = document.createElement('div');
      meta.className = 'up-meta';
      const name = document.createElement('span');
      name.className = 'up-name';
      name.textContent = item.name;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'up-remove';
      rm.setAttribute('aria-label', 'Quitar ' + item.name);
      rm.textContent = '✕';
      rm.addEventListener('click', () => {
        fotosFiles.splice(idx, 1);
        renderFotosPreviews();
      });
      meta.appendChild(name);
      meta.appendChild(rm);
      tile.appendChild(img);
      tile.appendChild(meta);
      previews.appendChild(tile);
    });
  }

  async function onLogoChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) { logoFile = null; renderLogoPreview(); return; }
    if (file.size > MAX_FILE_BYTES) {
      setNote('⚠ El logo supera los 3 MB. Subí un archivo más liviano.', 'is-error');
      e.target.value = '';
      logoFile = null;
      renderLogoPreview();
      return;
    }
    try { logoFile = await readFile(file); } catch { logoFile = null; }
    e.target.value = '';
    renderLogoPreview();
  }

  async function onFotosChange(e) {
    const newFiles = Array.prototype.slice.call(e.target.files || []);
    const combined = fotosFiles.concat(newFiles);
    if (combined.length > MAX_FOTOS) {
      const room = MAX_FOTOS - fotosFiles.length;
      setNote('⚠ Ya cargaste ' + fotosFiles.length + ' foto(s) de ' + MAX_FOTOS + '. Podés agregar ' + room + ' más.', 'is-error');
      e.target.value = '';
      return;
    }
    const oversized = newFiles.some((f) => f.size > MAX_FILE_BYTES);
    if (oversized) {
      setNote('⚠ Una de las fotos supera los 3 MB. Subí archivos más livianos.', 'is-error');
      e.target.value = '';
      return;
    }
    const loaded = [];
    for (const f of newFiles) { try { loaded.push(await readFile(f)); } catch {} }
    fotosFiles = fotosFiles.concat(loaded);
    e.target.value = '';
    renderFotosPreviews();
  }

  const fotosUpload = document.getElementById('fotos-upload');
  const logoUpload = document.getElementById('logo-upload');
  if (logoUpload) {
    const logoFileInput = logoUpload.querySelector('input[type="file"]');
    if (logoFileInput) logoFileInput.addEventListener('change', onLogoChange);
  }
  if (fotosUpload) {
    const fotosFileInput = fotosUpload.querySelector('input[type="file"]');
    if (fotosFileInput) fotosFileInput.addEventListener('change', onFotosChange);
  }

  function syncUploadVisibility() {
    toggleUpload('logo-upload', 'logo', ['Sí, tengo logo']);
    toggleUpload('fotos-upload', 'fotos', ['Fotos profesionales de alta calidad', 'Fotos básicas de celular']);
  }
  form.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'logo') syncUploadVisibility();
    if (e.target && e.target.name === 'fotos') syncUploadVisibility();
    if (e.target && e.target.name === 'secciones') syncBlogEditVisibility();
  });
  syncUploadVisibility();

  /* Blog: muestra la opción de página de edición/actualización solo si
     el cliente marcó "Blog" en las secciones. */
  function syncBlogEditVisibility() {
    const box = document.getElementById('blog-edit-box');
    if (!box) return;
    const blogChecked = !!form.querySelector('input[name="secciones"][value="Blog"]:checked');
    box.hidden = !blogChecked;
    if (!blogChecked) {
      const cb = box.querySelector('input[name="blog_edicion"]');
      if (cb) cb.checked = false;
    }
  }
  syncBlogEditVisibility();

  /* ── Construir resumen listo para la IA ── */
  function buildPrompt() {
    const L = [];
    const sep = '═══════════════════════════════════════════════════════════';
    L.push(sep);
    L.push('  BRIEFING SHC DIGITAL — DISEÑO DE SITIO WEB CON IA (ONESHOT)');
    L.push(sep);
    L.push('');

    // Solo se incluyen los campos completados (vacíos quedan fuera)
    function line(label, value) {
      const v = value == null ? '' : String(value).trim();
      if (v) L.push('- ' + label + ': ' + v);
    }

    L.push('[1] EMPRESA Y CONTACTO');
    line('Empresa / Marca', val('empresa'));
    line('Rubro / Profesión', val('rubro'));
    line('Email', val('email'));
    line('WhatsApp', val('whatsapp'));
    line('Ciudad / País', val('ciudad'));
    L.push('');

    L.push('[2] SOBRE EL NEGOCIO');
    line('¿A qué se dedica?', val('que_haces'));
    line('Audiencia objetivo', val('audiencia'));
    line('Propuesta de valor', val('valor'));
    line('Diferencial frente a la competencia', val('diferencial'));
    line('Objetivo principal del sitio', radio('objetivo'));
    line('Competencia', val('competencia'));
    line('Sitios de referencia', val('referencias'));
    const redesChecked = checks('redes');
    const redesOtras = val('redes_otras');
    const redesConUser = redesConUsuarios();
    const redesParts = redesConUser.length
      ? redesConUser.map((r) => r.red + (r.usuario ? ' (@' + r.usuario + ')' : ''))
      : redesChecked.slice();
    if (redesOtras) redesParts.push(redesOtras);
    line('Redes sociales', redesParts.join(', '));
    L.push('');

    L.push('[3] CONTENIDO Y MARCA');
    line('Textos', radio('textos'));
    line('Fotos', radio('fotos'));
    line('Logo', radio('logo'));
    line('Paleta de colores', radio('colores'));
    line('Estilo visual', radio('estilo'));
    line('Tono de voz', radio('tono'));
    if (logoFile) L.push('- Adjuntos: logo subido (' + logoFile.name + ')');
    if (fotosFiles.length) L.push('- Adjuntos: ' + fotosFiles.length + ' foto(s) subida(s)');
    L.push('');

    L.push('[4] ESTRUCTURA Y FUNCIONALIDADES');
    line('Tipo de sitio', radio('tipo_sitio'));
    line('Páginas / secciones', list(checks('secciones')));
    line('Otras secciones', val('secciones_otras'));
    line('Blog: edición y actualización', list(checks('blog_edicion')));
    line('Contacto', radio('contacto_modo'));
    line('Acción principal (CTA)', radio('cta'));
    line('Funcionalidades extras', list(checks('funcionalidades')));
    line('Idioma', radio('idioma'));
    L.push('');

    L.push('[5] DOMINIO');
    const dominioRaw = val('dominio');
    if (domainStatus) {
      line('Dominio', domainStatus.full + ' — ' + (domainStatus.disponible ? 'DISPONIBLE' : 'YA REGISTRADO'));
      if (!domainStatus.disponible) {
        L.push('  (el cliente eligió un dominio ya registrado: sugerí alternativas cercanas)');
      }
    } else if (dominioRaw) {
      line('Dominio', dominioRaw);
    }
    L.push('');

    L.push('[6] NOTAS ADICIONALES');
    line('Notas', val('notas'));
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
      redes: checks('redes'),
      redes_con_usuarios: redesConUsuarios(),
      redes_otras: val('redes_otras'),
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
      logo_file: logoFile,
      fotos_files: fotosFiles,
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
