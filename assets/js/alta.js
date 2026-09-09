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
  var cpMap = window.GF_CP_COLONIAS || {};
  var cpInput = $('#al-cp'), colSel = $('#al-colonia'), alcInput = $('#al-alcaldia'), cpHint = $('#al-cp-hint');

  function limpiarColonia() {
    colSel.innerHTML = '<option value="">Escribe el CP primero</option>';
    alcInput.value = '';
  }

  cpInput.addEventListener('input', function () {
    var cp = cpInput.value.replace(/\D/g, '').slice(0, 5);
    cpInput.value = cp;
    if (cp.length < 5) { cpHint.textContent = ''; cpHint.className = 'alta-cp-hint'; limpiarColonia(); return; }
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
    return window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }).then(function (resultado) {
      var blob = Array.isArray(resultado) ? resultado[0] : resultado;
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
    });
  }

  var fotoAviso = $('#altaFotoAviso'), fotosWrap = $('#altaPhotos'), addBtn = $('#altaPhotoAdd'), fotoInput = $('#altaFotoInput');
  var sessionId = 'sol-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  function renderFotos() {
    $$('.alta-photo', fotosWrap).forEach(function (n) { n.remove(); });
    fotos.forEach(function (url, i) {
      var div = document.createElement('div');
      div.className = 'alta-photo';
      div.innerHTML = '<img src="' + url + '" alt="Foto ' + (i + 1) + '"><button type="button" aria-label="Quitar foto">&times;</button>';
      div.querySelector('button').addEventListener('click', function () { fotos.splice(i, 1); renderFotos(); });
      fotosWrap.insertBefore(div, addBtn);
    });
  }

  function handleFiles(files) {
    if (!SUPABASE_READY) { fotoAviso.textContent = 'No se pudo conectar para subir fotos, intenta de nuevo en un momento.'; return; }
    var lista = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type) || esHeicPorNombre(f); });
    if (!lista.length) return;
    fotoAviso.textContent = '';
    subiendo += lista.length;

    Promise.all(lista.map(function (file) {
      return detectarHeicPorContenido(file).then(function (esHeicReal) {
        var prep = esHeicReal
          ? convertirHeicAJpeg(file).catch(function () {
              fotoAviso.textContent = 'No pudimos abrir "' + file.name + '" — mándala por WhatsApp y descárgala de ahí antes de subirla aquí.';
              return null;
            })
          : Promise.resolve(file);
        return prep;
      }).then(function (f) {
        if (!f) return null;
        var ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        var ruta = sessionId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        return sb.storage.from('solicitudes-alta').upload(ruta, f).then(function (res) {
          if (res.error) { fotoAviso.textContent = 'No se pudo subir ' + f.name + '.'; return null; }
          return sb.storage.from('solicitudes-alta').getPublicUrl(ruta).data.publicUrl;
        });
      });
    })).then(function (urls) {
      urls.filter(Boolean).forEach(function (u) { fotos.push(u); });
      subiendo -= lista.length;
      renderFotos();
    });
  }

  fotoInput.addEventListener('change', function () { handleFiles(fotoInput.files); fotoInput.value = ''; });

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
    var mailOk = !mail.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value);
    marcaError(mail.closest('.form-row'), !mailOk); if (!mailOk) ok = false;
    marcaError(tipo.closest('.form-row'), !tipo.value); if (!tipo.value) ok = false;
    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (subiendo > 0) { fotoAviso.textContent = 'Espera a que terminen de subirse las fotos.'; return; }
    if (!validar()) return;

    var btn = $('#altaSubmitBtn');
    btn.disabled = true;
    var textoOriginal = btn.textContent;
    btn.textContent = 'Enviando…';

    var amenidades = $$('input[name="amenidad"]:checked').map(function (c) { return c.value; });

    var payload = {
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
          btn.disabled = false; btn.textContent = textoOriginal;
          fotoAviso.textContent = 'No se pudo enviar tu registro, intenta de nuevo en un momento.';
          return;
        }
        form.style.display = 'none';
        $('#altaSuccess').classList.add('is-on');
      }).catch(function () {
        btn.disabled = false; btn.textContent = textoOriginal;
        fotoAviso.textContent = 'No se pudo enviar tu registro, revisa tu conexión e intenta de nuevo.';
      });
  });
})();
