/* ==========================================================================
   Panel de asesores — Gio Filio
   Conectado a Supabase: auth.signInWithPassword, tabla `propiedades_manual`
   (con RLS — cada asesor solo ve/edita las suyas, Gio como admin las ve
   todas) y Storage (bucket `propiedades-manual`) para las fotos. Ver
   _generador/sql/schema.sql para el esquema completo.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.GF_ADMIN_CONFIG || {};
  var SUPABASE_READY = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  var sb = SUPABASE_READY ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;

  var AMENIDADES = [];       // se llena desde assets/data/amenidades.json
  var AMENIDAD_LABEL = {};
  var COLONIAS = [];         // se llena desde assets/data/colonias.json
  var CP_A_COLONIA = {};     // '11510' -> 'polanco', armado a partir de COLONIAS

  var STATE = { propiedades: [], leads: [], equipo: [], editingId: null, editingLeadId: null, fotos: [], session: null, perfil: null };

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

  function setBusy(btn, busy, textoOcupado) {
    if (!btn) return;
    if (busy) {
      btn.dataset.textoOriginal = btn.textContent;
      btn.textContent = textoOcupado || 'Guardando…';
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.textoOriginal || btn.textContent;
      btn.disabled = false;
    }
  }

  // ------------------------------------------------------------- CATÁLOGOS
  function cargarCatalogos() {
    return Promise.all([
      fetch('../assets/data/amenidades.json').then(function (r) { return r.json(); }).catch(function () { return []; }),
      fetch('../assets/data/colonias.json').then(function (r) { return r.json(); }).catch(function () { return []; }),
    ]).then(function (res) {
      AMENIDADES = res[0];
      AMENIDADES.forEach(function (a) { AMENIDAD_LABEL[a.slug] = a.label; });
      COLONIAS = res[1];
      COLONIAS.forEach(function (c) {
        (c.cp || []).forEach(function (cp) { CP_A_COLONIA[cp] = c.slug; });
      });
      $('#amenidadesGrid').innerHTML = AMENIDADES.map(function (a) {
        return (
          '<label class="chip-check">' +
            '<input type="checkbox" value="' + a.slug + '" name="amenidad">' +
            '<span>' + esc(a.label) + '</span>' +
          '</label>'
        );
      }).join('');
      // ~1500 colonias — se agrupan por alcaldía (<optgroup>) para que el
      // <select> nativo siga siendo navegable en vez de una lista plana.
      var porAlcaldia = {};
      COLONIAS.forEach(function (c) {
        (porAlcaldia[c.alcaldia] = porAlcaldia[c.alcaldia] || []).push(c);
      });
      var alcaldias = Object.keys(porAlcaldia).sort();
      var sel = $('#f_colonia');
      sel.innerHTML = '<option value="">Selecciona una colonia…</option>' + alcaldias.map(function (alc) {
        var opciones = porAlcaldia[alc].map(function (c) {
          return '<option value="' + c.slug + '">' + esc(c.nombre) + '</option>';
        }).join('');
        return '<optgroup label="' + esc(alc) + '">' + opciones + '</optgroup>';
      }).join('');
    });
  }

  // --------------------------------------------------------------- SALUDO
  function saludoPorHora() {
    var h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }
  var MENSAJES_BIENVENIDA = [
    'Sigamos haciendo que este sea tu mejor mes.',
    'Cada propiedad que subes es un paso más cerca de tu próxima venta.',
    'Un contacto bien atendido hoy es una firma mañana.',
    'Gracias por ser una pieza clave de este equipo.',
    'Vamos por más — tú puedes con esto.',
    'Hoy es un buen día para cerrar algo grande.',
  ];
  function actualizarSaludo() {
    var nombre = (STATE.perfil && STATE.perfil.nombre) || (STATE.session && STATE.session.user.email) || 'Asesor';
    var primerNombre = nombre.trim().split(' ')[0];
    $('#greetingSaludo').textContent = saludoPorHora() + ', ' + primerNombre + '.';
    $('#greetingMsg').textContent = MENSAJES_BIENVENIDA[Math.floor(Math.random() * MENSAJES_BIENVENIDA.length)];
  }

  // --------------------------------------------------------------- AUTH
  function showApp() {
    var nombre = (STATE.perfil && STATE.perfil.nombre) || (STATE.session && STATE.session.user.email) || 'Asesor';
    $('#gate').style.display = 'none';
    $('#setPasswordGate').hidden = true;
    $('#app').classList.add('is-visible');
    $('#userName').textContent = nombre;
    $('#userAvatar').textContent = nombre.trim().charAt(0).toUpperCase();
    actualizarSaludo();
    var esAdmin = STATE.perfil && STATE.perfil.rol === 'admin';
    $('#tabEquipo').hidden = !esAdmin;
    cargarPropiedades();
    cargarLeads();
    if (esAdmin) cargarEquipo();
  }

  function showGate() {
    $('#app').classList.remove('is-visible');
    $('#setPasswordGate').hidden = true;
    $('#gate').style.display = 'flex';
  }

  function handleLogin(e) {
    e.preventDefault();
    var email = $('#loginEmail').value.trim();
    var pass = $('#loginPass').value;
    var errBox = $('#loginError');
    var submitBtn = $('#loginForm button[type="submit"]');
    errBox.classList.remove('show');

    if (!email || !pass) {
      errBox.textContent = 'Ingresa tu correo y contraseña.';
      errBox.classList.add('show');
      return;
    }
    if (!SUPABASE_READY) {
      errBox.textContent = 'Panel en construcción: la conexión con Supabase todavía no está configurada.';
      errBox.classList.add('show');
      return;
    }

    setBusy(submitBtn, true, 'Entrando…');
    sb.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
      setBusy(submitBtn, false);
      if (res.error) {
        errBox.textContent = res.error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : res.error.message;
        errBox.classList.add('show');
        return;
      }
      STATE.session = res.data.session;
      cargarPerfilYMostrar();
    });
  }

  function cargarPerfilYMostrar() {
    sb.from('perfiles').select('nombre, rol, activo').eq('id', STATE.session.user.id).single().then(function (res) {
      STATE.perfil = res.data || null;
      if (STATE.perfil && STATE.perfil.activo === false) {
        sb.auth.signOut().then(function () {
          STATE.session = null;
          STATE.perfil = null;
          showGate();
          var errBox = $('#loginError');
          errBox.textContent = 'Tu acceso al panel fue desactivado — contacta a Gio.';
          errBox.classList.add('show');
        });
        return;
      }
      showApp();
    });
  }

  function handleLogout() {
    sb.auth.signOut().then(function () {
      STATE.session = null;
      STATE.perfil = null;
      showGate();
      $('#loginEmail').value = '';
      $('#loginPass').value = '';
    });
  }

  // ------------------------------------------------------ CREAR CONTRASEÑA (invitación)
  // El link del correo de invitación trae el token en el hash de la URL
  // (#access_token=...&type=invite); supabase-js ya lo detecta solo y deja
  // la sesión lista (detectSessionInUrl, activo por default) -- aquí solo se
  // detecta el caso para mostrar "crea tu contraseña" en vez del login normal.
  function esFlujoDeContrasena() {
    return /type=invite|type=recovery/.test(location.hash || '');
  }

  function handleSetPassword(e) {
    e.preventDefault();
    var p1 = $('#newPass').value, p2 = $('#newPass2').value;
    var errBox = $('#setPasswordError');
    errBox.classList.remove('show');
    if (p1.length < 8) { errBox.textContent = 'La contraseña debe tener al menos 8 caracteres.'; errBox.classList.add('show'); return; }
    if (p1 !== p2) { errBox.textContent = 'Las contraseñas no coinciden.'; errBox.classList.add('show'); return; }

    var btn = $('#setPasswordForm button[type="submit"]');
    setBusy(btn, true, 'Guardando…');
    sb.auth.updateUser({ password: p1 }).then(function (res) {
      if (res.error) {
        setBusy(btn, false);
        errBox.textContent = res.error.message;
        errBox.classList.add('show');
        return;
      }
      sb.auth.getSession().then(function (sessionRes) {
        STATE.session = sessionRes.data.session;
        history.replaceState(null, '', location.pathname);
        sb.from('perfiles').update({ activado_en: new Date().toISOString() }).eq('id', STATE.session.user.id).then(function () {
          setBusy(btn, false);
          cargarPerfilYMostrar();
        });
      });
    });
  }

  // --------------------------------------------------------------- GRID
  function renderStats() {
    var disponibles = STATE.propiedades.filter(function (p) { return p.estado === 'disponible'; });
    $('#statDisponibles').textContent = disponibles.length;
    $('#statVenta').textContent = disponibles.filter(function (p) { return p.operacion === 'venta'; }).length;
    $('#statRenta').textContent = disponibles.filter(function (p) { return p.operacion === 'renta'; }).length;
    $('#statBorradores').textContent = STATE.propiedades.filter(function (p) { return p.estado === 'borrador'; }).length;
    $('#statPausadas').textContent = STATE.propiedades.filter(function (p) { return p.estado === 'pausada'; }).length;
  }

  function coloniaLabel(slug) {
    var c = COLONIAS.filter(function (x) { return x.slug === slug; })[0];
    return c ? c.nombre : slug;
  }

  // Reproduce el mismo slug que arma _generador/prep.py (normalize()) para
  // poder enlazar directo a la ficha en giofilio.com sin ir y venir con el
  // sitio en cada publicación. Si esa lógica cambia allá, hay que
  // actualizarla aquí también.
  var TIPO_LABEL_ADMIN = {
    'departamento': 'Departamento', 'casa': 'Casa', 'casa-en-condominio': 'Casa en condominio',
    'penthouse': 'Penthouse', 'loft': 'Loft', 'terreno': 'Terreno', 'oficina': 'Oficina',
    'local-comercial': 'Local comercial'
  };
  function slugifyPy(s) {
    s = s.toLowerCase();
    var rep = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n' };
    for (var k in rep) s = s.split(k).join(rep[k]);
    return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function urlPublicacion(p) {
    var detalleParte = '';
    if (p.titulo && p.titulo.indexOf(' con ') !== -1) {
      var partes = p.titulo.split(' con ');
      detalleParte = partes[partes.length - 1];
    }
    var base = slugifyPy((TIPO_LABEL_ADMIN[p.tipo] || p.tipo) + ' ' + coloniaLabel(p.colonia_slug) + ' ' + detalleParte);
    var visto = {}, dedup = [];
    base.split('-').forEach(function (w) { if (!visto[w]) { visto[w] = true; dedup.push(w); } });
    return 'https://www.giofilio.com/propiedad/' + dedup.join('-') + '-gf' + p.id.slice(0, 8).toLowerCase() + '/';
  }

  function pcardHtml(p) {
    var meta = [];
    if (p.rec) meta.push(p.rec + ' rec');
    if (p.ban) meta.push(p.ban + ' baños');
    if (p.m2c) meta.push(p.m2c + ' m²');
    if (p.m2t) meta.push(p.m2t + ' m² terreno');
    var badge = p.estado === 'disponible'
      ? '<span class="pcard-badge">' + (p.operacion === 'renta' ? 'Renta' : 'Venta') + '</span>'
      : '<span class="pcard-badge borrador">' + (p.estado === 'pausada' ? 'Pausada' : 'Borrador') + '</span>';
    var foto = (p.fotos && p.fotos[0]) || '';
    var togglePausa = p.estado !== 'borrador'
      ? '<button class="btn btn--ghost" data-toggle-pausa="' + p.id + '">' + (p.estado === 'pausada' ? 'Activar' : 'Pausar') + '</button>'
      : '';
    var verLink = p.estado === 'disponible'
      ? '<a class="btn btn--ghost" href="' + esc(urlPublicacion(p)) + '" target="_blank" rel="noopener">Ver</a>'
      : '';
    return (
      '<div class="pcard" data-id="' + p.id + '">' +
        '<div class="pcard-media">' + badge +
          (foto ? '<img src="' + esc(foto) + '" alt="" loading="lazy">' : '') +
        '</div>' +
        '<div class="pcard-body">' +
          '<div class="pcard-price">' + nf.format(p.precio || 0) + (p.operacion === 'renta' ? ' /mes' : '') + '</div>' +
          '<div class="pcard-title">' + esc(p.titulo || 'Sin título') + '</div>' +
          '<div class="pcard-meta"><span>' + esc(coloniaLabel(p.colonia_slug)) + '</span><span>' + meta.join(' · ') + '</span></div>' +
          '<div class="pcard-actions">' +
            verLink +
            togglePausa +
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

  function cargarPropiedades() {
    var esAdmin = STATE.perfil && STATE.perfil.rol === 'admin';
    var q = sb.from('propiedades_manual').select('*').order('creado_en', { ascending: false });
    if (!esAdmin) q = q.eq('asesor_id', STATE.session.user.id);
    q.then(function (res) {
      if (res.error) {
        toast('No se pudieron cargar tus propiedades: ' + res.error.message, 'err');
        return;
      }
      STATE.propiedades = res.data || [];
      renderGrid();
    });
  }

  // --------------------------------------------------------------- MODAL / FORM
  // El título siempre se arma solo (tipo + operación + colonia) en vez de
  // dejarlo como texto libre — evita que cada asesor titule sus fichas de
  // forma distinta ("depa", "departamentito", "bello departamento"...).
  // "Detalle" es el único texto libre, y se pega al final.
  function tituloAuto() {
    var tipoSel = $('#f_tipo');
    var tipoLabel = tipoSel.options[tipoSel.selectedIndex] ? tipoSel.options[tipoSel.selectedIndex].text : '';
    var operacionTexto = $('#f_operacion').value === 'renta' ? 'renta' : 'venta';
    var coloniaSel = $('#f_colonia');
    var coloniaNombre = coloniaSel.selectedIndex > 0 && coloniaSel.options[coloniaSel.selectedIndex]
      ? coloniaSel.options[coloniaSel.selectedIndex].text : '';
    if (!coloniaNombre) return '';
    var detalle = $('#f_detalle').value.trim();
    return tipoLabel + ' en ' + operacionTexto + ' en ' + coloniaNombre + (detalle ? ', ' + detalle : '');
  }

  function actualizarPreview() {
    var t = tituloAuto();
    $('#tituloPreview').textContent = t ? '"' + t + '"' : '';
  }

  function setOperacion(op) {
    $$('.op-toggle button').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.op === op);
    });
    $('#f_operacion').value = op;
    actualizarPreview();
  }

  function openModal(prop) {
    STATE.editingId = prop ? prop.id : null;
    STATE.fotos = prop && prop.fotos ? prop.fotos.slice() : [];
    $('#modalTitle').textContent = prop ? 'Editar propiedad' : 'Nueva propiedad';
    $('#f_detalle').value = prop ? prop.detalle || '' : '';
    $('#f_tipo').value = prop ? prop.tipo : 'departamento';
    $('#f_precio').value = prop ? prop.precio : '';
    $('#f_cp').value = '';
    $('#f_cp_hint').textContent = '';
    avisoFoto(null);
    $('#f_colonia').value = prop ? prop.colonia_slug : '';
    $('#f_rec').value = prop ? prop.rec || '' : '';
    $('#f_ban').value = prop ? prop.ban || '' : '';
    $('#f_est').value = prop ? prop.est || '' : '';
    $('#f_m2c').value = prop ? prop.m2c || '' : '';
    $('#f_m2t').value = prop ? prop.m2t || '' : '';
    $('#f_descripcion').value = prop ? prop.descripcion || '' : '';
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
    }).join('') + (STATE._subiendo ? '<div class="photo-thumb photo-thumb--loading">Subiendo…</div>' : '');
  }

  // HEIC/HEIF (formato por default de la cámara de iPhone) no se ve en la
  // mayoría de navegadores ni en redes sociales/WhatsApp al compartir el
  // link. Los navegadores que sí pueden decodificarlo (Safari) lo dibujan
  // sin problema en un <img>, así que se aprovecha eso para convertirlo a
  // JPEG en el momento; donde no se puede (Chrome, Firefox, Android) se
  // avisa claro en vez de subir un archivo que se verá roto en el sitio.
  function esHeicPorNombre(file) {
    return /\.(heic|heif)$/i.test(file.name) || /^image\/(heic|heif)/i.test(file.type);
  }

  // Algunas apps (incluyendo la de Fotos de iPhone en ciertos flujos de
  // exportar/compartir) renombran el archivo a ".jpg" sin convertirlo de
  // verdad — el nombre y el tipo dicen "jpg" pero el contenido real sigue
  // siendo HEIC, así que hay que revisar los bytes del archivo, no confiar
  // en su nombre.
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

  // heic2any decodifica HEIC/HEIF por software (WASM) — funciona igual en
  // Chrome/Android/Windows que en Safari, a diferencia del truco anterior
  // (dibujar en un <canvas>) que solo servía en navegadores que YA sabían
  // leer HEIC de forma nativa (básicamente solo Safari).
  function convertirHeicAJpeg(file) {
    return window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }).then(function (resultado) {
      var blob = Array.isArray(resultado) ? resultado[0] : resultado;
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
    });
  }

  function avisoFoto(msg) {
    var el = $('#fotoAviso');
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  function handleFiles(files) {
    if (!SUPABASE_READY) { toast('Conecta Supabase para poder subir fotos', 'err'); return; }
    var lista = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type) || esHeicPorNombre(f); });
    if (!lista.length) return;
    avisoFoto(null);
    STATE._subiendo = true;
    renderPhotoStrip();

    var carpeta = STATE.session.user.id + '/' + (STATE.editingId || ('tmp-' + Date.now()));
    Promise.all(lista.map(function (file) {
      return detectarHeicPorContenido(file).then(function (esHeicReal) {
        var prep = esHeicReal
          ? convertirHeicAJpeg(file).catch(function () {
              avisoFoto(
                'No pudimos abrir "' + file.name + '" — el archivo sigue siendo HEIC por dentro aunque su nombre diga .jpg (pasa cuando la app de Fotos solo lo renombra, sin convertirlo de verdad), y este navegador no puede leerlo. ' +
                'Solución más fácil: en tu iPhone ve a Ajustes → Cámara → Formatos, y cambia a "Más compatible" — así las fotos nuevas ya se guardan en JPG real y este problema no vuelve a pasar. ' +
                'Para esta foto en particular, mándatela por WhatsApp y descarga la que te llega (esa sí queda convertida), y vuelve a subirla aquí.'
              );
              return null;
            })
          : Promise.resolve(file);
        return prep;
      }).then(function (f) {
        if (!f) return null;
        var ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        var ruta = carpeta + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        return sb.storage.from('propiedades-manual').upload(ruta, f).then(function (res) {
          if (res.error) { toast('No se pudo subir ' + f.name + ': ' + res.error.message, 'err'); return null; }
          return sb.storage.from('propiedades-manual').getPublicUrl(ruta).data.publicUrl;
        });
      });
    })).then(function (urls) {
      urls.filter(Boolean).forEach(function (u) { STATE.fotos.push(u); });
      STATE._subiendo = false;
      renderPhotoStrip();
    });
  }

  function collectForm() {
    var amenidades = $$('input[name="amenidad"]:checked').map(function (c) { return c.value; });
    return {
      titulo: tituloAuto(),
      detalle: $('#f_detalle').value.trim(),
      operacion: $('#f_operacion').value,
      tipo: $('#f_tipo').value,
      precio: Number($('#f_precio').value) || 0,
      colonia_slug: $('#f_colonia').value,
      rec: Number($('#f_rec').value) || 0,
      ban: Number($('#f_ban').value) || 0,
      est: Number($('#f_est').value) || 0,
      m2c: Number($('#f_m2c').value) || 0,
      m2t: Number($('#f_m2t').value) || 0,
      descripcion: $('#f_descripcion').value.trim(),
      amenidades: amenidades,
      fotos: STATE.fotos.slice(),
    };
  }

  function avisarRebuild() {
    if (!STATE.session) return;
    fetch('/api/rebuild', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + STATE.session.access_token },
    }).catch(function () { /* el respaldo por hora lo recoge de todas formas */ });
  }

  function saveProperty(publicar) {
    if (!$('#f_colonia').value) {
      toast('Elige la colonia de la propiedad', 'err');
      return;
    }
    var data = collectForm();
    if (!data.precio) {
      toast('Falta el precio', 'err');
      return;
    }
    if (publicar && !data.fotos.length) {
      toast('Agrega al menos una foto antes de publicar', 'err');
      return;
    }
    data.estado = publicar ? 'disponible' : 'borrador';
    var btn = publicar ? $('#publishBtn') : $('#saveDraftBtn');
    setBusy(btn, true, publicar ? 'Publicando…' : 'Guardando…');

    var query = STATE.editingId
      ? sb.from('propiedades_manual').update(data).eq('id', STATE.editingId)
      : sb.from('propiedades_manual').insert(Object.assign({ asesor_id: STATE.session.user.id }, data));

    query.then(function (res) {
      setBusy(btn, false);
      if (res.error) {
        toast('No se pudo guardar: ' + res.error.message, 'err');
        return;
      }
      closeModal();
      toast(publicar ? 'Propiedad publicada' : 'Borrador guardado');
      cargarPropiedades();
      if (publicar) avisarRebuild();
    });
  }

  function togglePausa(id) {
    var p = STATE.propiedades.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var nuevoEstado = p.estado === 'pausada' ? 'disponible' : 'pausada';
    sb.from('propiedades_manual').update({ estado: nuevoEstado }).eq('id', id).then(function (res) {
      if (res.error) {
        toast('No se pudo actualizar: ' + res.error.message, 'err');
        return;
      }
      toast(nuevoEstado === 'pausada' ? 'Propiedad pausada' : 'Propiedad activada de nuevo');
      cargarPropiedades();
      avisarRebuild();
    });
  }

  function deleteProperty(id) {
    if (!confirm('¿Eliminar esta propiedad? Esta acción no se puede deshacer.')) return;
    sb.from('propiedades_manual').delete().eq('id', id).then(function (res) {
      if (res.error) {
        toast('No se pudo eliminar: ' + res.error.message, 'err');
        return;
      }
      toast('Propiedad eliminada');
      cargarPropiedades();
      avisarRebuild();
    });
  }

  // --------------------------------------------------------------- TABS
  function setView(view) {
    $('#viewPropiedades').hidden = view !== 'propiedades';
    $('#viewContactos').hidden = view !== 'contactos';
    $('#viewEquipo').hidden = view !== 'equipo';
    $('#tabPropiedades').classList.toggle('is-active', view === 'propiedades');
    $('#tabContactos').classList.toggle('is-active', view === 'contactos');
    $('#tabEquipo').classList.toggle('is-active', view === 'equipo');
    $('#addPropBtnFab').style.display = view === 'propiedades' && STATE.propiedades.length ? 'inline-flex' : 'none';
  }

  // --------------------------------------------------------------- EQUIPO (solo admin)
  function contarPropiedadesActivas(asesorId) {
    return STATE.propiedades.filter(function (p) { return p.asesor_id === asesorId && p.estado === 'disponible'; }).length;
  }

  function teamRowHtml(p) {
    var inicial = (p.nombre || p.email || '?').trim().charAt(0).toUpperCase();
    var pendiente = !p.activado_en;
    var esUnoMismo = !!(STATE.session && p.id === STATE.session.user.id);
    var n = contarPropiedadesActivas(p.id);
    return (
      '<div class="team-row' + (p.activo ? '' : ' is-inactivo') + '">' +
        '<div class="team-row-id">' +
          '<div class="avatar">' + esc(inicial) + '</div>' +
          '<div><div class="team-row-name">' + esc(p.nombre || 'Sin nombre') + '</div>' +
          '<div class="team-row-email">' + esc(p.email || '') + '</div></div>' +
        '</div>' +
        (pendiente ? '<span class="team-row-badge is-pendiente">Invitación pendiente</span>' : '') +
        '<span class="team-row-props">' + n + ' propiedad' + (n === 1 ? '' : 'es') + ' activa' + (n === 1 ? '' : 's') + '</span>' +
        '<div class="team-row-actions">' +
          '<select class="team-role-select" data-rol-id="' + p.id + '"' + (esUnoMismo ? ' disabled title="No puedes cambiar tu propio rol"' : '') + '>' +
            '<option value="asesor"' + (p.rol === 'asesor' ? ' selected' : '') + '>Asesor</option>' +
            '<option value="admin"' + (p.rol === 'admin' ? ' selected' : '') + '>Admin</option>' +
          '</select>' +
          '<label class="switch">' +
            '<input type="checkbox" data-activo-id="' + p.id + '"' + (p.activo ? ' checked' : '') + (esUnoMismo ? ' disabled title="No puedes desactivarte a ti mismo"' : '') + '>' +
            '<span class="switch-track"></span>' + (p.activo ? 'Activo' : 'Desactivado') +
          '</label>' +
        '</div>' +
      '</div>'
    );
  }

  function renderEquipo() {
    $('#equipoLista').innerHTML = STATE.equipo.map(teamRowHtml).join('');
    $('#statAsesoresActivos').textContent = STATE.equipo.filter(function (p) { return p.activo; }).length;
    $('#statAsesoresInactivos').textContent = STATE.equipo.filter(function (p) { return !p.activo; }).length;
    $('#statInvitacionesPendientes').textContent = STATE.equipo.filter(function (p) { return !p.activado_en; }).length;
  }

  function cargarEquipo() {
    sb.from('perfiles').select('*').order('creado_en', { ascending: true }).then(function (res) {
      if (res.error) {
        console.warn('[Panel] no se pudo cargar el equipo:', res.error.message);
        return;
      }
      STATE.equipo = res.data || [];
      renderEquipo();
    });
  }

  function openInviteModal() {
    $('#inv_nombre').value = '';
    $('#inv_email').value = '';
    $('#inviteError').classList.remove('show');
    $('#inviteModalBackdrop').classList.add('is-open');
  }

  function closeInviteModal() {
    $('#inviteModalBackdrop').classList.remove('is-open');
  }

  function enviarInvitacion() {
    var nombre = $('#inv_nombre').value.trim();
    var email = $('#inv_email').value.trim();
    var errBox = $('#inviteError');
    errBox.classList.remove('show');
    if (!email) {
      errBox.textContent = 'Ingresa un correo.';
      errBox.classList.add('show');
      return;
    }
    var btn = $('#inviteSendBtn');
    setBusy(btn, true, 'Enviando…');
    fetch('/api/invitar-asesor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + STATE.session.access_token },
      body: JSON.stringify({ nombre: nombre, email: email }),
    }).then(function (r) {
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    }).then(function (res) {
      setBusy(btn, false);
      if (!res.ok || !res.data.ok) {
        var mensajes = {
          correo_invalido: 'Ese correo no es válido.',
          solo_un_admin_puede_invitar: 'Solo un admin puede invitar asesores.',
          supabase_no_configurado: 'Falta configurar Supabase en el servidor.',
          sesion_invalida: 'Tu sesión expiró, vuelve a iniciar sesión.',
        };
        var codigo = res.data && res.data.error;
        errBox.textContent = mensajes[codigo] || codigo || 'No se pudo enviar la invitación.';
        errBox.classList.add('show');
        return;
      }
      closeInviteModal();
      toast('Invitación enviada a ' + email);
      cargarEquipo();
    }).catch(function () {
      setBusy(btn, false);
      errBox.textContent = 'No se pudo conectar con el servidor.';
      errBox.classList.add('show');
    });
  }

  function cambiarRolAsesor(id, rol) {
    sb.from('perfiles').update({ rol: rol }).eq('id', id).then(function (res) {
      if (res.error) { toast('No se pudo cambiar el rol: ' + res.error.message, 'err'); cargarEquipo(); return; }
      toast('Rol actualizado');
      cargarEquipo();
    });
  }

  function cambiarActivoAsesor(id, activo) {
    sb.from('perfiles').update({ activo: activo }).eq('id', id).then(function (res) {
      if (res.error) { toast('No se pudo actualizar: ' + res.error.message, 'err'); cargarEquipo(); return; }
      toast(activo ? 'Asesor activado' : 'Asesor desactivado');
      cargarEquipo();
    });
  }

  // --------------------------------------------------------------- CONTACTOS (leads)
  var ESTADOS_LEAD = ['nuevo', 'contactado', 'activo', 'cerrado'];
  var ESTADO_LEAD_LABEL = { nuevo: 'Nuevo', contactado: 'Contactado', activo: 'Activo', cerrado: 'Cerrado' };

  var ICON_TEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var ICON_WA = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39c1.44.79 3.06 1.2 4.71 1.2h.01c5.46 0 9.9-4.45 9.9-9.91C21.91 6.45 17.5 2 12.04 2zm5.8 14.1c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.13.11-1.82-.12-.42-.14-.96-.32-1.65-.62-2.9-1.25-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3s.74-2.13 1-2.42c.26-.29.57-.36.76-.36h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.14.07.14.11.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.6-.14.24.09 1.53.72 1.79.85.26.14.43.2.5.32.07.12.07.68-.17 1.36z"/></svg>';
  var ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>';

  function tiempoRelativo(iso) {
    var min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60);
    if (h < 24) return h + ' h';
    return Math.floor(h / 24) + ' d';
  }

  function soloDigitos(tel) { return (tel || '').replace(/[^\d+]/g, ''); }

  function leadCardHtml(l) {
    var links = [];
    if (l.telefono) {
      var tel = soloDigitos(l.telefono);
      links.push('<a href="tel:' + esc(tel) + '" title="Llamar" onclick="event.stopPropagation()">' + ICON_TEL + '</a>');
      links.push('<a href="https://wa.me/' + esc(tel.replace(/^\+/, '')) + '" target="_blank" rel="noopener" title="WhatsApp" onclick="event.stopPropagation()">' + ICON_WA + '</a>');
    }
    if (l.email) {
      links.push('<a href="mailto:' + esc(l.email) + '" title="Correo" onclick="event.stopPropagation()">' + ICON_MAIL + '</a>');
    }
    return (
      '<div class="lead-card" draggable="true" data-lead-id="' + l.id + '">' +
        '<div class="lead-card-name">' + esc(l.nombre) + '</div>' +
        (l.propiedad_titulo ? '<div class="lead-card-prop">' + esc(l.propiedad_titulo) + '</div>' : '') +
        (l.mensaje ? '<div class="lead-card-msg">' + esc(l.mensaje) + '</div>' : '') +
        '<div class="lead-card-meta">' +
          '<span>' + tiempoRelativo(l.creado_en) + '</span>' +
          (links.length ? '<span class="lead-card-links">' + links.join('') + '</span>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function renderKanban() {
    var porEstado = {};
    ESTADOS_LEAD.forEach(function (e) { porEstado[e] = []; });
    STATE.leads.forEach(function (l) { (porEstado[l.estado] || porEstado.nuevo).push(l); });
    ESTADOS_LEAD.forEach(function (e) {
      $('#kcol_' + e).innerHTML = porEstado[e].map(leadCardHtml).join('');
      $('#kc_' + e).textContent = porEstado[e].length;
    });
    var hayLeads = STATE.leads.length > 0;
    $('#leadsEmptyState').style.display = hayLeads ? 'none' : 'block';
    $('#kanban').style.display = hayLeads ? 'grid' : 'none';
    var badge = $('#tabContactosBadge');
    badge.textContent = porEstado.nuevo.length;
    badge.hidden = !porEstado.nuevo.length;
  }

  function cargarLeads() {
    sb.from('leads').select('*').order('creado_en', { ascending: false }).then(function (res) {
      if (res.error) {
        // Tabla `leads` puede no existir todavia si no se ha corrido el SQL
        // mas reciente — no se interrumpe el resto del panel por esto.
        console.warn('[Panel] no se pudieron cargar los contactos:', res.error.message);
        return;
      }
      STATE.leads = res.data || [];
      renderKanban();
    });
  }

  function cambiarEstadoLead(id, estado) {
    var l = STATE.leads.filter(function (x) { return x.id === id; })[0];
    if (!l || l.estado === estado) return;
    var anterior = l.estado;
    l.estado = estado;
    renderKanban();
    sb.from('leads').update({ estado: estado }).eq('id', id).then(function (res) {
      if (res.error) {
        l.estado = anterior;
        renderKanban();
        toast('No se pudo mover el contacto: ' + res.error.message, 'err');
        return;
      }
      toast('Contacto movido a "' + ESTADO_LEAD_LABEL[estado] + '"');
    });
  }

  function openLeadModal(l) {
    STATE.editingLeadId = l.id;
    var tel = soloDigitos(l.telefono);
    $('#leadModalTitle').textContent = l.nombre || 'Contacto';
    $('#leadModalBody').innerHTML = (
      '<div class="lead-detail"><dl>' +
        (l.telefono ? '<dt>Teléfono</dt><dd><a href="tel:' + esc(tel) + '">' + esc(l.telefono) + '</a> · <a href="https://wa.me/' + esc(tel.replace(/^\+/, '')) + '" target="_blank" rel="noopener">WhatsApp</a></dd>' : '') +
        (l.email ? '<dt>Correo</dt><dd><a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a></dd>' : '') +
        (l.propiedad_titulo ? '<dt>Propiedad de interés</dt><dd>' + esc(l.propiedad_titulo) + (l.propiedad_precio ? ' — ' + esc(l.propiedad_precio) : '') + '</dd>' : '') +
        (l.mensaje ? '<dt>Mensaje</dt><dd>' + esc(l.mensaje) + '</dd>' : '') +
        '<dt>Origen</dt><dd>' + esc(l.formulario || 'contacto') + ' · ' + esc(l.fuente || 'sitio_web') + '</dd>' +
        '<dt>Recibido</dt><dd>' + new Date(l.creado_en).toLocaleString('es-MX') + '</dd>' +
      '</dl></div>' +
      '<div class="field" style="margin-top:1.2rem">' +
        '<label for="leadNotas">Notas internas</label>' +
        '<textarea id="leadNotas" rows="3" placeholder="Notas de seguimiento…">' + esc(l.notas || '') + '</textarea>' +
      '</div>'
    );
    $('#leadEstadoSelect').value = l.estado;
    $('#leadModalBackdrop').classList.add('is-open');
  }

  function closeLeadModal() {
    $('#leadModalBackdrop').classList.remove('is-open');
    STATE.editingLeadId = null;
  }

  function guardarNotasLead() {
    if (!STATE.editingLeadId) return;
    var notas = $('#leadNotas').value;
    var btn = $('#leadGuardarNotasBtn');
    setBusy(btn, true, 'Guardando…');
    sb.from('leads').update({ notas: notas }).eq('id', STATE.editingLeadId).then(function (res) {
      setBusy(btn, false);
      if (res.error) { toast('No se pudo guardar la nota: ' + res.error.message, 'err'); return; }
      var l = STATE.leads.filter(function (x) { return x.id === STATE.editingLeadId; })[0];
      if (l) l.notas = notas;
      toast('Nota guardada');
    });
  }

  // --------------------------------------------------------------- INIT
  document.addEventListener('DOMContentLoaded', function () {
    cargarCatalogos();

    $('#loginForm').addEventListener('submit', handleLogin);
    $('#logoutBtn').addEventListener('click', handleLogout);
    $('#addPropBtn').addEventListener('click', function () { openModal(null); });
    $('#emptyAddBtn').addEventListener('click', function () { openModal(null); });
    $('#addPropBtnFab').addEventListener('click', function () { openModal(null); });

    $('#tabPropiedades').addEventListener('click', function () { setView('propiedades'); });
    $('#tabContactos').addEventListener('click', function () { setView('contactos'); });
    $('#tabEquipo').addEventListener('click', function () { setView('equipo'); });

    $('#addAsesorBtn').addEventListener('click', openInviteModal);
    $('#inviteModalClose').addEventListener('click', closeInviteModal);
    $('#inviteModalBackdrop').addEventListener('click', function (e) { if (e.target.id === 'inviteModalBackdrop') closeInviteModal(); });
    $('#inviteSendBtn').addEventListener('click', enviarInvitacion);
    $('#equipoLista').addEventListener('change', function (e) {
      var rolId = e.target.dataset.rolId;
      var activoId = e.target.dataset.activoId;
      if (rolId) cambiarRolAsesor(rolId, e.target.value);
      else if (activoId) cambiarActivoAsesor(activoId, e.target.checked);
    });

    $('#setPasswordForm').addEventListener('submit', handleSetPassword);

    $('#kanban').addEventListener('dragstart', function (e) {
      var card = e.target.closest && e.target.closest('.lead-card');
      if (!card) return;
      e.dataTransfer.setData('text/plain', card.dataset.leadId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });
    $('#kanban').addEventListener('dragend', function (e) {
      var card = e.target.closest && e.target.closest('.lead-card');
      if (card) card.classList.remove('is-dragging');
    });
    $('#kanban').addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) return;
      var card = e.target.closest && e.target.closest('.lead-card');
      if (!card) return;
      var l = STATE.leads.filter(function (x) { return x.id === card.dataset.leadId; })[0];
      if (l) openLeadModal(l);
    });
    $$('.kanban-col').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('is-dragover'); });
      col.addEventListener('dragleave', function () { col.classList.remove('is-dragover'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('is-dragover');
        var id = e.dataTransfer.getData('text/plain');
        if (id) cambiarEstadoLead(id, col.dataset.estado);
      });
    });

    $('#leadModalClose').addEventListener('click', closeLeadModal);
    $('#leadModalBackdrop').addEventListener('click', function (e) { if (e.target.id === 'leadModalBackdrop') closeLeadModal(); });
    $('#leadEstadoSelect').addEventListener('change', function () {
      if (STATE.editingLeadId) cambiarEstadoLead(STATE.editingLeadId, $('#leadEstadoSelect').value);
    });
    $('#leadGuardarNotasBtn').addEventListener('click', guardarNotasLead);
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalBackdrop').addEventListener('click', function (e) { if (e.target.id === 'modalBackdrop') closeModal(); });
    $('#saveDraftBtn').addEventListener('click', function () { saveProperty(false); });
    $('#publishBtn').addEventListener('click', function () { saveProperty(true); });

    $('#f_cp').addEventListener('input', function () {
      var cp = $('#f_cp').value.replace(/\D/g, '').slice(0, 5);
      $('#f_cp').value = cp;
      var hint = $('#f_cp_hint');
      if (cp.length < 5) { hint.textContent = ''; return; }
      var slug = CP_A_COLONIA[cp];
      if (slug) {
        $('#f_colonia').value = slug;
        var c = COLONIAS.filter(function (x) { return x.slug === slug; })[0];
        hint.textContent = c ? '✓ ' + c.nombre + ' — ' + c.alcaldia : '';
      } else {
        hint.textContent = 'CP no encontrado en el catálogo — elige la colonia manualmente.';
      }
      actualizarPreview();
    });

    $('#f_tipo').addEventListener('change', actualizarPreview);
    $('#f_colonia').addEventListener('change', actualizarPreview);
    $('#f_detalle').addEventListener('input', actualizarPreview);

    $$('.op-toggle button').forEach(function (b) {
      b.addEventListener('click', function () { setOperacion(b.dataset.op); });
    });

    $('#grid').addEventListener('click', function (e) {
      var editId = e.target.dataset.edit;
      var delId = e.target.dataset.del;
      var pausaId = e.target.dataset.togglePausa;
      if (editId) {
        var p = STATE.propiedades.filter(function (x) { return x.id === editId; })[0];
        openModal(p);
      } else if (delId) {
        deleteProperty(delId);
      } else if (pausaId) {
        togglePausa(pausaId);
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
      console.warn('[Panel Gio Filio] Supabase no configurado todavia — completa assets/js/admin-config.js.');
      return;
    }

    sb.auth.getSession().then(function (res) {
      STATE.session = res.data.session;
      if (!STATE.session) return;
      if (esFlujoDeContrasena()) {
        $('#gate').style.display = 'none';
        $('#setPasswordGate').hidden = false;
      } else {
        cargarPerfilYMostrar();
      }
    });
  });
})();
