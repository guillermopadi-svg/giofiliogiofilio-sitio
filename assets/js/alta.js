/* ==========================================================================
   Gio Filio — Formulario público de alta de propiedad (/alta-propiedad/)
   Sin login: escribe directo a Supabase (tabla solicitudes_alta, RLS abierta
   solo a INSERT para anon) y a la vez sube fotos al bucket publico
   'solicitudes-alta'. Ver _generador/sql/schema.sql para las políticas.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.GF_ADMIN_CONFIG || {};
  var SUPABASE_READY = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  var sb = SUPABASE_READY ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var form = $('#altaForm');
  var fotos = []; // URLs publicas ya subidas
  var subiendo = 0;

  // ------------------------------------------------------- Operación (seg)
  $$('.seg[aria-label="Operación"] button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.seg[aria-label="Operación"] button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      $('#al-operacion').value = b.dataset.op;
    });
  });

  // ------------------------------------------------------- CP -> colonia
  // cp-colonias.js pesa ~12 MB (catalogo de TODO el pais, no solo CDMX) --
  // se carga bajo demanda hasta que el propietario realmente empieza a
  // escribir su CP, no en cada visita a este formulario publico.
  var cpMap = null;
  var cpMapPromesa = null;
  function cargarCpMap() {
    if (!cpMapPromesa) {
      cpMapPromesa = new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = '../assets/data/cp-colonias.js';
        s.onload = function () { cpMap = window.GF_CP_COLONIAS || {}; resolve(cpMap); };
        s.onerror = function () { cpMap = {}; resolve(cpMap); };
        document.head.appendChild(s);
      });
    }
    return cpMapPromesa;
  }

  var cpInput = $('#al-cp'), colSel = $('#al-colonia'), alcInput = $('#al-alcaldia'), cpHint = $('#al-cp-hint');

  function limpiarColonia() {
    colSel.innerHTML = '<option value="">Escribe el CP primero</option>';
    alcInput.value = '';
  }

  cpInput.addEventListener('focus', cargarCpMap, { once: true });

  cpInput.addEventListener('input', function () {
    var cp = cpInput.value.replace(/\D/g, '').slice(0, 5);
    cpInput.value = cp;
    if (cp.length < 5) { cpHint.textContent = ''; cpHint.className = 'alta-cp-hint'; limpiarColonia(); return; }
    if (!cpMap) {
      cpHint.textContent = 'Buscando tu colonia…';
      cpHint.className = 'alta-cp-hint';
      cargarCpMap().then(function () { cpInput.dispatchEvent(new Event('input')); });
      return;
    }
    var opciones = cpMap[cp];
    if (!opciones || !opciones.length) {
      cpHint.textContent = 'No encontramos ese CP — escribe tu colonia y alcaldía abajo.';
      cpHint.className = 'alta-cp-hint';
      colSel.innerHTML = '<option value="">Escribe tu colonia</option>';
      colSel.disabled = false;
      colSel.removeAttribute('disabled');
      // Se convierte el select en algo editable no es posible; se deja el select
      // vacio y el usuario puede seleccionar "Otra" si se agrega, o dejamos
      // un input alterno. Simplificado: mostramos un unico input de texto.
      convertirColoniaATexto();
      return;
    }
    cpHint.textContent = opciones.length === 1 ? 'Colonia encontrada ✓' : opciones.length + ' colonias con este CP — elige la tuya';
    cpHint.className = 'alta-cp-hint is-ok';
    colSel.innerHTML = opciones.map(function (o, i) {
      return '<option value="' + o.colonia.replace(/"/g, '&quot;') + '" data-alc="' + o.alcaldia.replace(/"/g, '&quot;') + '"' + (i === 0 ? ' selected' : '') + '>' + o.colonia + '</option>';
    }).join('');
    alcInput.value = opciones[0].alcaldia;
  });

  var coloniaEsTexto = false;
  function convertirColoniaATexto() {
    if (coloniaEsTexto) return;
    coloniaEsTexto = true;
    var input = document.createElement('input');
    input.type = 'text'; input.id = 'al-colonia'; input.name = 'colonia'; input.placeholder = 'Nombre de tu colonia';
    colSel.parentNode.replaceChild(input, colSel);
    colSel = input;
    alcInput.removeAttribute('readonly');
    alcInput.placeholder = 'Nombre de tu alcaldía';
  }

  colSel.addEventListener('change', function () {
    if (coloniaEsTexto) return;
    var opt = colSel.options[colSel.selectedIndex];
    alcInput.value = opt ? (opt.dataset.alc || '') : '';
  });

  // ------------------------------------------------------- Legal/financiero
  function wireDetalle(selId, detId) {
    var sel = $(selId), det = $(detId);
    if (!sel || !det) return;
    function sync() {
      var off = sel.value === 'no';
      det.disabled = off;
      if (off) det.value = '';
    }
    sel.addEventListener('change', sync);
    sync();
  }
  wireDetalle('#al-hipoteca', '#al-hipoteca-detalle');
  wireDetalle('#al-gravamen', '#al-gravamen-detalle');
  wireDetalle('#al-deuda-admin', '#al-deuda-admin-detalle');

  // ------------------------------------------------------- Fotos
  function esHeicPorNombre(file) {
    return /\.(heic|heif)$/i.test(file.name) || /^image\/(heic|heif)/i.test(file.type);
  }
  function detectarHeicPorContenido(file) {
    return file.slice(0, 12).arrayBuffer().then(function (buf) {
      var b = new Uint8Array(buf);
      if (b.length < 12) return false;
      var caja = String.fromCharCode(b[4], b[5], b[6], b[7]);
      if (caja !== 'ftyp') return false;
      var marca = String.fromCharCode(b[8], b[9], b[10], b[11]);
      return ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevx', 'mif1', 'msf1'].indexOf(marca) !== -1;
    }).catch(function () { return false; });
  }
  function convertirHeicAJpeg(file) {
    return import('./vendor/heic-to-1.5.2.js').then(function (decoder) {
      return decoder.heicTo({ blob: file, type: 'image/jpeg', quality: 0.85 });
    }).then(function (resultado) {
      var blob = Array.isArray(resultado) ? resultado[0] : resultado;
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
    });
  }

  // Reexportar siempre: elimina EXIF y reduce fotos grandes antes de subirlas.
  function limpiarExifJpeg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        try {
          var escala = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error('No se pudo preparar la imagen.')); return; }
            resolve(new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.85);
        } catch (err) { reject(err); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen. Prueba con JPG o PNG.')); };
      img.src = url;
    });
  }

  var fotoAviso = $('#altaFotoAviso'), fotosWrap = $('#altaPhotos'), addBtn = $('#altaPhotoAdd'), fotoInput = $('#altaFotoInput');
  var sessionId = 'sol-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  var colaFotos = [], procesando = false, enviando = false;
  var MAX_FOTOS = 30;

  function renderFotos() {
    fotos = colaFotos.filter(function (item) { return item.estado === 'lista'; }).map(function (item) { return item.url; });
    $$('.alta-photo', fotosWrap).forEach(function (n) { n.remove(); });
    colaFotos.forEach(function (item) {
      var div = document.createElement('div'); div.className = 'alta-photo is-' + item.estado;
      if (item.url) {
        var img = document.createElement('img'); img.src = item.url; img.alt = item.file.name; div.appendChild(img);
      }
      var nombre = document.createElement('span'); nombre.className = 'alta-photo-name'; nombre.textContent = item.file.name; div.appendChild(nombre);
      var estado = document.createElement('span'); estado.className = 'alta-photo-state';
      estado.textContent = item.estado === 'lista' ? '✓ Lista' : item.estado === 'error' ? item.error : item.estado === 'subiendo' ? 'Subiendo…' : 'En espera…';
      div.appendChild(estado);
      if (item.estado === 'error') {
        var retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Reintentar';
        retry.addEventListener('click', function () { item.estado = 'pendiente'; procesarCola(); }); div.appendChild(retry);
      }
      var quitar = document.createElement('button'); quitar.type = 'button'; quitar.textContent = 'Quitar';
      quitar.disabled = item.estado === 'subiendo' || enviando;
      quitar.setAttribute('aria-label', 'Quitar ' + item.file.name);
      quitar.addEventListener('click', function () { colaFotos = colaFotos.filter(function (f) { return f !== item; }); renderFotos(); }); div.appendChild(quitar);
      fotosWrap.appendChild(div);
    });
    var pendientes = colaFotos.filter(function (item) { return item.estado === 'pendiente' || item.estado === 'subiendo'; }).length;
    var fallidas = colaFotos.filter(function (item) { return item.estado === 'error'; }).length;
    subiendo = pendientes;
    $('#altaFotoEstado').textContent = fotos.length + ' de ' + colaFotos.length + ' fotos listas' + (pendientes ? ' · Cargando…' : '') + (fallidas ? ' · ' + fallidas + ' con error' : '');
    $('#altaSubmitBtn').disabled = enviando || pendientes > 0 || fallidas > 0;
    fotoInput.disabled = enviando;
    if (fallidas) fotoAviso.textContent = 'Reintenta las fotos con error o quítalas antes de enviar. Tus datos siguen aquí.';
    else fotoAviso.textContent = '';
  }

  function procesarCola() {
    renderFotos();
    if (procesando) return;
    var item = colaFotos.find(function (f) { return f.estado === 'pendiente'; });
    if (!item) return;
    procesando = true; item.estado = 'subiendo'; renderFotos();
    Promise.resolve().then(function () {
      if (!SUPABASE_READY) throw new Error('No hay conexión con el servicio de fotos. Intenta otra vez.');
      if (item.file.size > 40 * 1024 * 1024) throw new Error('La imagen supera 40 MB. Elige una versión más pequeña.');
      return detectarHeicPorContenido(item.file);
    }).then(function (heic) {
      return heic || esHeicPorNombre(item.file) ? convertirHeicAJpeg(item.file) : item.file;
    }).then(limpiarExifJpeg).then(function (file) {
      if (file.size > 8 * 1024 * 1024) throw new Error('La imagen sigue superando 8 MB. Elige una versión más pequeña.');
      var ruta = sessionId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      return sb.storage.from('solicitudes-alta').upload(ruta, file, { contentType: 'image/jpeg' }).then(function (res) {
        if (res.error) throw res.error;
        item.url = sb.storage.from('solicitudes-alta').getPublicUrl(ruta).data.publicUrl;
        item.estado = 'lista';
      });
    }).catch(function (err) {
      item.estado = 'error';
      item.error = 'No se pudo cargar. ' + (err && err.message ? err.message : 'Comprueba tu conexión y reintenta.');
    }).then(function () { procesando = false; procesarCola(); });
  }

  function handleFiles(files) {
    var lista = Array.prototype.slice.call(files);
    lista.forEach(function (file) {
      if (colaFotos.length >= MAX_FOTOS) return;
      var aceptada = /^image\//.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
      colaFotos.push({ file: file, estado: aceptada ? 'pendiente' : 'error', error: 'Formato no compatible. Usa JPG, PNG, WebP o HEIC.' });
    });
    procesarCola();
    if (lista.length && colaFotos.length >= MAX_FOTOS) fotoAviso.textContent = 'Máximo 30 fotos. Revisa que estén todas las que quieres enviar.';
  }
  fotoInput.addEventListener('change', function () { handleFiles(fotoInput.files); fotoInput.value = ''; });
  addBtn.addEventListener('dragover', function (e) { e.preventDefault(); addBtn.classList.add('is-dragging'); });
  addBtn.addEventListener('dragleave', function () { addBtn.classList.remove('is-dragging'); });
  addBtn.addEventListener('drop', function (e) { e.preventDefault(); addBtn.classList.remove('is-dragging'); if (!enviando) handleFiles(e.dataTransfer.files); });

  // ------------------------------------------------------- Envío
  function marcaError(row, on) {
    if (!row) return;
    row.classList.toggle('is-error', !!on);
  }

  function validar() {
    var ok = true;
    var nombre = $('#al-nombre'), tel = $('#al-tel'), mail = $('#al-mail'), tipo = $('#al-tipo');
    marcaError(nombre.closest('.form-row'), !nombre.value.trim()); if (!nombre.value.trim()) ok = false;
    var telOk = tel.value.replace(/\D/g, '').length >= 10;
    marcaError(tel.closest('.form-row'), !telOk); if (!telOk) ok = false;
    var mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim());
    marcaError(mail.closest('.form-row'), !mailOk); if (!mailOk) ok = false;
    marcaError(tipo.closest('.form-row'), !tipo.value); if (!tipo.value) ok = false;
    var curp = $('#al-curp');
    var curpOk = !curp.value.trim() || /^[A-Z0-9]{18}$/.test(curp.value.trim().toUpperCase());
    marcaError(curp.closest('.form-row'), !curpOk); if (!curpOk) ok = false;
    var consent = $('input[name="consent"]');
    if (!consent.checked) { ok = false; $('#altaEnvioAviso').textContent = 'Acepta el aviso de privacidad para enviar tu registro.'; }
    if (!ok) { var primero = $('.is-error input, .is-error select'); if (primero) primero.focus(); }
    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    $('#altaEnvioAviso').textContent = '';
    if (enviando) return;
    if (colaFotos.some(function (item) { return item.estado === 'error'; })) { fotoAviso.textContent = 'Reintenta o quita las fotos con error antes de enviar.'; return; }
    if (subiendo > 0) { fotoAviso.textContent = 'Espera a que terminen de subirse las fotos.'; return; }
    if (!fotos.length) { fotoAviso.textContent = 'Agrega al menos una foto de la propiedad antes de enviar.'; fotoInput.focus(); return; }
    if (!validar()) return;

    var btn = $('#altaSubmitBtn');
    enviando = true; renderFotos();
    btn.disabled = true;
    var textoOriginal = btn.textContent;
    btn.textContent = 'Enviando…';

    var amenidades = $$('input[name="amenidad"]:checked').map(function (c) { return c.value; });

    var payload = {
      consentimiento: true,
      curp: $('#al-curp').value.trim().toUpperCase(),
      nombre: $('#al-nombre').value.trim(),
      apellido: $('#al-apellido').value.trim(),
      telefono: $('#al-tel').value.trim(),
      email: $('#al-mail').value.trim(),
      operacion: $('#al-operacion').value,
      tipo: $('#al-tipo').value,
      precio: Number($('#al-precio').value) || 0,
      calle: $('#al-calle').value.trim(),
      numero: $('#al-num').value.trim(),
      colonia: colSel.value || '',
      alcaldia: alcInput.value || '',
      cp: cpInput.value,
      rec: Number($('#al-rec').value) || 0,
      ban: Number($('#al-ban').value) || 0,
      est: Number($('#al-est').value) || 0,
      m2c: Number($('#al-m2c').value) || 0,
      m2t: Number($('#al-m2t').value) || 0,
      antig: Number($('#al-antig').value) || 0,
      hipoteca: $('#al-hipoteca').value,
      hipoteca_detalle: $('#al-hipoteca-detalle').value.trim(),
      gravamen: $('#al-gravamen').value,
      gravamen_detalle: $('#al-gravamen-detalle').value.trim(),
      deuda_admin: $('#al-deuda-admin').value,
      deuda_admin_detalle: $('#al-deuda-admin-detalle').value.trim(),
      amenidades: amenidades,
      descripcion: $('#al-desc').value.trim(),
      fotos: fotos,
    };

    fetch('/api/alta-propiedad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (!data || data.ok !== true) {
          enviando = false; renderFotos(); btn.textContent = textoOriginal;
          $('#altaEnvioAviso').textContent = data && data.error === 'demasiados_intentos'
            ? 'Se hicieron demasiados intentos seguidos desde esta conexión — espera unos minutos e intenta de nuevo.'
            : data && data.error === 'fotos_requeridas' ? 'Agrega al menos una foto de la propiedad antes de enviar.' : 'No se pudo enviar tu registro, intenta de nuevo en un momento.';
          return;
        }
        form.style.display = 'none';
        $('#altaSuccess').classList.add('is-on');
      }).catch(function () {
        enviando = false; renderFotos(); btn.textContent = textoOriginal;
        $('#altaEnvioAviso').textContent = 'No se pudo enviar tu registro, revisa tu conexión e intenta de nuevo.';
      });
  });
})();
