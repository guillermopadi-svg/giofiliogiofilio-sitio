/* ==========================================================================
   Panel de asesores — Gio Filio
   Hoy corre con datos de muestra (MOCK_PROPIEDADES). En cuanto exista el
   proyecto de Supabase, cada función marcada "TODO Supabase" se conecta a
   la tabla real (propiedades / propiedad_fotos) en lugar de al arreglo local.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.GF_ADMIN_CONFIG || {};
  var SUPABASE_READY = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);

  var AMENIDADES = [
    'seguridad', 'elevador', 'gimnasio', 'roof-garden', 'terraza', 'bodega',
    'cuarto-servicio', 'salon-eventos', 'estacionamiento-visitas', 'pet-friendly',
    'alberca', 'jardin', 'chimenea', 'vigilancia-24h'
  ];
  var AMENIDADES_LABEL = {
    'seguridad': 'Seguridad', 'elevador': 'Elevador', 'gimnasio': 'Gimnasio',
    'roof-garden': 'Roof garden', 'terraza': 'Terraza', 'bodega': 'Bodega',
    'cuarto-servicio': 'Cuarto de servicio', 'salon-eventos': 'Salón de eventos',
    'estacionamiento-visitas': 'Estac. visitas', 'pet-friendly': 'Pet friendly',
    'alberca': 'Alberca', 'jardin': 'Jardín', 'chimenea': 'Chimenea',
    'vigilancia-24h': 'Vigilancia 24h'
  };

  // Datos de muestra — misma forma que la tabla real que crearemos en Supabase
  var MOCK_PROPIEDADES = [
    {
      id: 'mock-1', titulo: 'Departamento con terraza y vista a Chapultepec',
      operacion: 'venta', tipo: 'departamento', precio: 12900000,
      colonia_nombre: 'Polanco', alcaldia_nombre: 'Miguel Hidalgo',
      rec: 3, ban: 3, medios: 1, est: 2, m2c: 185,
      amenidades: ['seguridad', 'elevador', 'terraza', 'gimnasio'],
      estado: 'disponible', destacada: true,
      foto_card: '../assets/img/properties/foto-51-card.jpg'
    },
    {
      id: 'mock-2', titulo: 'Terreno con uso de suelo habitacional en Coyoacán',
      operacion: 'venta', tipo: 'terreno', precio: 9600000,
      colonia_nombre: 'Coyoacán', alcaldia_nombre: 'Coyoacán',
      rec: 0, ban: 0, medios: 0, est: 0, m2t: 480,
      amenidades: [], estado: 'disponible', destacada: false,
      foto_card: '../assets/img/properties/foto-42-card.jpg'
    }
  ];

  var STATE = { propiedades: MOCK_PROPIEDADES.slice(), editingId: null, fotos: [] };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var nf = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

  function toast(msg, type) {
    var wrap = $('#toastWrap');
    var t = document.createElement('div');
    t.className = 'toast' + (type === 'err' ? ' is-err' : ' is-ok');
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-visible'); });
    setTimeout(function () {
      t.classList.remove('is-visible');
      setTimeout(function () { t.remove(); }, 250);
    }, 2800);
  }

  // --------------------------------------------------------------- AUTH
  function showApp(nombre) {
    $('#gate').style.display = 'none';
    $('#app').classList.add('is-visible');
    $('#userName').textContent = nombre || 'Asesor';
    $('#userAvatar').textContent = (nombre || 'A').trim().charAt(0).toUpperCase();
    renderGrid();
  }

  function handleLogin(e) {
    e.preventDefault();
    var email = $('#loginEmail').value.trim();
    var pass = $('#loginPass').value;
    var errBox = $('#loginError');
    errBox.classList.remove('show');

    if (!email || !pass) {
      errBox.textContent = 'Ingresa tu correo y contraseña.';
      errBox.classList.add('show');
      return;
    }

    if (!SUPABASE_READY) {
      // TODO Supabase: reemplazar por supabase.auth.signInWithPassword({ email, password: pass })
      toast('Modo de prueba: entrando con datos de muestra (Supabase aún no conectado)');
      showApp(email.split('@')[0]);
      return;
    }

    // TODO Supabase: flujo real de autenticación
    // supabase.auth.signInWithPassword({ email, password: pass }).then(...)
    toast('Conexión a Supabase pendiente de configurar', 'err');
  }

  function handleLogout() {
    // TODO Supabase: supabase.auth.signOut()
    $('#app').classList.remove('is-visible');
    $('#gate').style.display = 'flex';
    $('#loginEmail').value = '';
    $('#loginPass').value = '';
  }

  // --------------------------------------------------------------- GRID
  function renderStats() {
    var total = STATE.propiedades.length;
    var disponibles = STATE.propiedades.filter(function (p) { return p.estado === 'disponible'; }).length;
    var destacadas = STATE.propiedades.filter(function (p) { return p.destacada; }).length;
    $('#statTotal').textContent = total;
    $('#statDisponibles').textContent = disponibles;
    $('#statDestacadas').textContent = destacadas;
    $('#statVenta').textContent = STATE.propiedades.filter(function (p) { return p.operacion === 'venta'; }).length;
  }

  function pcardHtml(p) {
    var meta = [];
    if (p.rec) meta.push(p.rec + ' rec');
    if (p.ban) meta.push(p.ban + ' baños');
    if (p.m2c) meta.push(p.m2c + ' m²');
    if (p.m2t) meta.push(p.m2t + ' m² terreno');
    var badge = p.estado === 'disponible'
      ? '<span class="pcard-badge">' + (p.operacion === 'renta' ? 'Renta' : 'Venta') + '</span>'
      : '<span class="pcard-badge borrador">Borrador</span>';
    return (
      '<div class="pcard" data-id="' + p.id + '">' +
        '<div class="pcard-media">' + badge +
          (p.foto_card ? '<img src="' + esc(p.foto_card) + '" alt="">' : '') +
        '</div>' +
        '<div class="pcard-body">' +
          '<div class="pcard-price">' + nf.format(p.precio || 0) + (p.operacion === 'renta' ? ' /mes' : '') + '</div>' +
          '<div class="pcard-title">' + esc(p.titulo || 'Sin título') + '</div>' +
          '<div class="pcard-meta"><span>' + esc(p.colonia_nombre || '') + '</span><span>' + meta.join(' · ') + '</span></div>' +
          '<div class="pcard-actions">' +
            '<button class="btn btn--ghost" data-edit="' + p.id + '">Editar</button>' +
            '<button class="btn btn--danger" data-del="' + p.id + '">Eliminar</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderGrid() {
    var grid = $('#grid');
    if (!STATE.propiedades.length) {
      grid.innerHTML = '';
      $('#emptyState').style.display = 'block';
    } else {
      $('#emptyState').style.display = 'none';
      grid.innerHTML = STATE.propiedades.map(pcardHtml).join('');
    }
    renderStats();
  }

  // --------------------------------------------------------------- MODAL / FORM
  function amenidadesHtml() {
    return AMENIDADES.map(function (a) {
      return (
        '<label class="chip-check">' +
          '<input type="checkbox" value="' + a + '" name="amenidad">' +
          '<span>' + AMENIDADES_LABEL[a] + '</span>' +
        '</label>'
      );
    }).join('');
  }

  function setOperacion(op) {
    $$('.op-toggle button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.op === op);
    });
    $('#f_operacion').value = op;
  }

  function openModal(prop) {
    STATE.editingId = prop ? prop.id : null;
    STATE.fotos = prop && prop.foto_card ? [prop.foto_card] : [];
    $('#modalTitle').textContent = prop ? 'Editar propiedad' : 'Nueva propiedad';
    $('#f_titulo').value = prop ? prop.titulo : '';
    $('#f_tipo').value = prop ? prop.tipo : 'departamento';
    $('#f_precio').value = prop ? prop.precio : '';
    $('#f_colonia').value = prop ? prop.colonia_nombre : '';
    $('#f_alcaldia').value = prop ? prop.alcaldia_nombre : '';
    $('#f_rec').value = prop ? prop.rec || '' : '';
    $('#f_ban').value = prop ? prop.ban || '' : '';
    $('#f_est').value = prop ? prop.est || '' : '';
    $('#f_m2c').value = prop ? prop.m2c || '' : '';
    setOperacion(prop ? prop.operacion : 'venta');
    $$('input[name="amenidad"]').forEach(function (chk) {
      chk.checked = !!(prop && prop.amenidades && prop.amenidades.indexOf(chk.value) !== -1);
    });
    renderPhotoStrip();
    $('#modalBackdrop').classList.add('is-open');
  }

  function closeModal() {
    $('#modalBackdrop').classList.remove('is-open');
  }

  function renderPhotoStrip() {
    var strip = $('#photoStrip');
    strip.innerHTML = STATE.fotos.map(function (src, i) {
      return (
        '<div class="photo-thumb"><img src="' + esc(src) + '" alt="">' +
          '<button type="button" data-photo-del="' + i + '">&times;</button></div>'
      );
    }).join('');
  }

  function handleFiles(files) {
    Array.prototype.forEach.call(files, function (file) {
      if (!/^image\//.test(file.type)) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        // TODO Supabase: subir a Supabase Storage (bucket "propiedades") y
        // guardar la URL pública devuelta en vez del data URL local.
        STATE.fotos.push(e.target.result);
        renderPhotoStrip();
      };
      reader.readAsDataURL(file);
    });
  }

  function collectForm() {
    var amenidades = $$('input[name="amenidad"]:checked').map(function (c) { return c.value; });
    return {
      id: STATE.editingId || ('mock-' + Date.now()),
      titulo: $('#f_titulo').value.trim(),
      operacion: $('#f_operacion').value,
      tipo: $('#f_tipo').value,
      precio: Number($('#f_precio').value) || 0,
      colonia_nombre: $('#f_colonia').value.trim(),
      alcaldia_nombre: $('#f_alcaldia').value.trim(),
      rec: Number($('#f_rec').value) || 0,
      ban: Number($('#f_ban').value) || 0,
      est: Number($('#f_est').value) || 0,
      m2c: Number($('#f_m2c').value) || 0,
      amenidades: amenidades,
      foto_card: STATE.fotos[0] || '',
      destacada: false,
      estado: 'disponible'
    };
  }

  function saveProperty(publicar) {
    var data = collectForm();
    if (!data.titulo || !data.precio) {
      toast('Falta título o precio', 'err');
      return;
    }
    data.estado = publicar ? 'disponible' : 'borrador';

    // TODO Supabase: reemplazar por upsert real
    // supabase.from('propiedades').upsert({ ...data, asesor_id: currentUser.id })
    var idx = STATE.propiedades.findIndex(function (p) { return p.id === data.id; });
    if (idx !== -1) STATE.propiedades[idx] = data;
    else STATE.propiedades.unshift(data);

    renderGrid();
    closeModal();
    toast(publicar ? 'Propiedad publicada' : 'Borrador guardado');
  }

  function deleteProperty(id) {
    if (!confirm('¿Eliminar esta propiedad? Esta acción no se puede deshacer.')) return;
    // TODO Supabase: supabase.from('propiedades').delete().eq('id', id)
    STATE.propiedades = STATE.propiedades.filter(function (p) { return p.id !== id; });
    renderGrid();
    toast('Propiedad eliminada');
  }

  // --------------------------------------------------------------- INIT
  document.addEventListener('DOMContentLoaded', function () {
    $('#amenidadesGrid').innerHTML = amenidadesHtml();

    $('#loginForm').addEventListener('submit', handleLogin);
    $('#logoutBtn').addEventListener('click', handleLogout);
    $('#addPropBtn').addEventListener('click', function () { openModal(null); });
    $('#emptyAddBtn').addEventListener('click', function () { openModal(null); });
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalBackdrop').addEventListener('click', function (e) { if (e.target.id === 'modalBackdrop') closeModal(); });
    $('#saveDraftBtn').addEventListener('click', function () { saveProperty(false); });
    $('#publishBtn').addEventListener('click', function () { saveProperty(true); });

    $$('.op-toggle button').forEach(function (b) {
      b.addEventListener('click', function () { setOperacion(b.dataset.op); });
    });

    $('#grid').addEventListener('click', function (e) {
      var editId = e.target.dataset.edit;
      var delId = e.target.dataset.del;
      if (editId) {
        var p = STATE.propiedades.find(function (x) { return x.id === editId; });
        openModal(p);
      } else if (delId) {
        deleteProperty(delId);
      }
    });

    var dz = $('#dropzone');
    var fileInput = $('#fileInput');
    dz.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { handleFiles(fileInput.files); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('is-drag'); });
    });
    dz.addEventListener('drop', function (e) { handleFiles(e.dataTransfer.files); });

    $('#photoStrip').addEventListener('click', function (e) {
      var i = e.target.dataset.photoDel;
      if (i !== undefined) { STATE.fotos.splice(Number(i), 1); renderPhotoStrip(); }
    });

    if (!SUPABASE_READY) {
      console.warn('[Panel Gio Filio] Supabase no configurado todavia — corriendo en modo de prueba con assets/js/admin-config.js vacio.');
    }
  });
})();
