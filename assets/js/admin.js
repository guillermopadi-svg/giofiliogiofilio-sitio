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

  var STATE = { propiedades: [], leads: [], tareas: [], equipo: [], invitaciones: [], solicitudes: [], solEditando: null, estudios: [], estudioEditando: null, editingId: null, editingLeadId: null, fotos: [], session: null, perfil: null };

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
    $('#app').classList.add('is-visible');
    $('#userName').textContent = nombre;
    $('#userAvatar').textContent = nombre.trim().charAt(0).toUpperCase();
    actualizarSaludo();
    var esAdmin = STATE.perfil && STATE.perfil.rol === 'admin';
    $('#tabEquipo').hidden = !esAdmin;
    cargarPropiedades();
    cargarLeads();
    cargarTareas();
    cargarSolicitudes();
    cargarEstudios();
    if (esAdmin) cargarEquipo();
  }

  function showGate() {
    $('#app').classList.remove('is-visible');
    $('#gate').style.display = 'flex';
  }

  // Login es solo con Google -- sin contraseñas que puedan filtrarse,
  // reusarse de otro sitio, o forzarse por fuerza bruta. Quién puede
  // entrar de verdad lo decide `invitaciones`/`perfiles` del lado del
  // servidor (ver handle_new_user() en schema.sql), no este botón.
  function handleGoogleLogin() {
    if (!SUPABASE_READY) {
      var errBox = $('#loginError');
      errBox.textContent = 'Panel en construcción: la conexión con Supabase todavía no está configurada.';
      errBox.classList.add('show');
      return;
    }
    sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
  }

  // Si Google redirige de vuelta con un error en el hash (p. ej. porque el
  // trigger handle_new_user() rechazó el correo por no estar invitado), se
  // muestra un aviso claro en vez de dejar la URL con un error crudo.
  function mostrarErrorDeAuthSiHay() {
    if (!/error=/.test(location.hash || '')) return false;
    var errBox = $('#loginError');
    errBox.textContent = 'No pudimos iniciar tu sesión. Si tu correo no ha sido invitado, pídele a Gio que te agregue primero en "Equipo".';
    errBox.classList.add('show');
    history.replaceState(null, '', location.pathname);
    return true;
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
    $('#viewTareas').hidden = view !== 'tareas';
    $('#viewSolicitudes').hidden = view !== 'solicitudes';
    $('#viewEstimador').hidden = view !== 'estimador';
    $('#viewEquipo').hidden = view !== 'equipo';
    $('#tabPropiedades').classList.toggle('is-active', view === 'propiedades');
    $('#tabContactos').classList.toggle('is-active', view === 'contactos');
    $('#tabTareas').classList.toggle('is-active', view === 'tareas');
    $('#tabSolicitudes').classList.toggle('is-active', view === 'solicitudes');
    $('#tabEstimador').classList.toggle('is-active', view === 'estimador');
    $('#tabEquipo').classList.toggle('is-active', view === 'equipo');
    $('#addPropBtnFab').style.display = view === 'propiedades' && STATE.propiedades.length ? 'inline-flex' : 'none';
  }

  // --------------------------------------------------------------- TAREAS
  function tareaVencidaP(t) {
    return t.estado === 'pendiente' && t.vence && new Date(t.vence) < new Date(new Date().toDateString());
  }

  function formatFechaCorta(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  function taskRowHtml(t) {
    var vencida = tareaVencidaP(t);
    var hecha = t.estado === 'hecha';
    return (
      '<div class="task-row' + (hecha ? ' is-hecha' : '') + '">' +
        '<button type="button" class="task-check' + (hecha ? ' is-checked' : '') + '" data-toggle-tarea="' + t.id + '" title="' + (hecha ? 'Marcar como pendiente' : 'Marcar como hecha') + '">' +
          (hecha ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>' : '') +
        '</button>' +
        '<div class="task-body">' +
          '<div class="task-titulo">' + esc(t.titulo) + '</div>' +
          (t.descripcion ? '<div class="task-desc">' + esc(t.descripcion) + '</div>' : '') +
        '</div>' +
        (t.vence ? '<span class="task-vence' + (vencida ? ' is-vencida' : '') + '">' + (vencida ? 'Venció ' : '') + formatFechaCorta(t.vence) + '</span>' : '') +
        '<button type="button" class="task-del" data-del-tarea="' + t.id + '" title="Eliminar">' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>' +
        '</button>' +
      '</div>'
    );
  }

  function renderTareas() {
    var lista = STATE.tareas;
    $('#tareasEmptyState').style.display = lista.length ? 'none' : 'block';
    $('#tareasLista').style.display = lista.length ? 'flex' : 'none';
    $('#tareasLista').innerHTML = lista.map(taskRowHtml).join('');
    var pendientes = lista.filter(function (t) { return t.estado === 'pendiente'; });
    $('#statTareasPendientes').textContent = pendientes.length;
    $('#statTareasVencidas').textContent = pendientes.filter(tareaVencidaP).length;
    $('#statTareasHechas').textContent = lista.filter(function (t) { return t.estado === 'hecha'; }).length;
    var badge = $('#tabTareasBadge');
    badge.textContent = pendientes.length;
    badge.hidden = !pendientes.length;
  }

  function cargarTareas() {
    var esAdmin = STATE.perfil && STATE.perfil.rol === 'admin';
    var q = sb.from('tareas').select('*').order('vence', { ascending: true, nullsFirst: false }).order('creado_en', { ascending: true });
    if (!esAdmin) q = q.eq('asesor_id', STATE.session.user.id);
    q.then(function (res) {
      if (res.error) { console.warn('[Panel] no se pudieron cargar las tareas:', res.error.message); return; }
      // Pendientes primero (vencidas arriba de todas), hechas al final.
      var data = res.data || [];
      data.sort(function (a, b) {
        if ((a.estado === 'hecha') !== (b.estado === 'hecha')) return a.estado === 'hecha' ? 1 : -1;
        return 0;
      });
      STATE.tareas = data;
      renderTareas();
    });
  }

  function openTareaModal() {
    $('#tarea_titulo').value = '';
    $('#tarea_vence').value = '';
    $('#tarea_descripcion').value = '';
    $('#tareaError').classList.remove('show');
    $('#tareaModalBackdrop').classList.add('is-open');
  }

  function closeTareaModal() {
    $('#tareaModalBackdrop').classList.remove('is-open');
  }

  function guardarTarea() {
    var titulo = $('#tarea_titulo').value.trim();
    var errBox = $('#tareaError');
    errBox.classList.remove('show');
    if (!titulo) {
      errBox.textContent = 'Ponle un título a la tarea.';
      errBox.classList.add('show');
      return;
    }
    var btn = $('#tareaGuardarBtn');
    setBusy(btn, true, 'Guardando…');
    sb.from('tareas').insert({
      asesor_id: STATE.session.user.id,
      titulo: titulo,
      descripcion: $('#tarea_descripcion').value.trim(),
      vence: $('#tarea_vence').value || null,
    }).then(function (res) {
      setBusy(btn, false);
      if (res.error) {
        errBox.textContent = 'No se pudo guardar: ' + res.error.message;
        errBox.classList.add('show');
        return;
      }
      closeTareaModal();
      toast('Tarea guardada');
      cargarTareas();
    });
  }

  function toggleTarea(id) {
    var t = STATE.tareas.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var nuevoEstado = t.estado === 'hecha' ? 'pendiente' : 'hecha';
    sb.from('tareas').update({ estado: nuevoEstado }).eq('id', id).then(function (res) {
      if (res.error) { toast('No se pudo actualizar: ' + res.error.message, 'err'); return; }
      cargarTareas();
    });
  }

  function eliminarTarea(id) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    sb.from('tareas').delete().eq('id', id).then(function (res) {
      if (res.error) { toast('No se pudo eliminar: ' + res.error.message, 'err'); return; }
      cargarTareas();
    });
  }

  // --------------------------------------------------------- SOLICITUDES DE ALTA
  // Vienen del formulario público /alta-propiedad/ -- cualquier visitante
  // puede insertar (RLS abierta a anon solo para insert), pero solo el
  // equipo autenticado puede verlas/editarlas. Ver schema.sql.
  function solRowHtml(s) {
    var lugar = [s.colonia, s.alcaldia].filter(Boolean).join(', ') || 'Sin ubicación';
    var nueva = s.estado === 'nueva';
    return (
      '<div class="task-row" data-open-sol="' + s.id + '" style="cursor:pointer">' +
        '<div class="task-check' + (nueva ? '' : ' is-checked') + '" style="pointer-events:none">' +
          (nueva ? '' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>') +
        '</div>' +
        '<div class="task-body">' +
          '<div class="task-titulo">' + esc(s.nombre) + ' ' + esc(s.apellido || '') + ' — ' + esc(TIPO_LABEL_SOL[s.tipo] || s.tipo) + ' en ' + (s.operacion === 'renta' ? 'renta' : 'venta') + '</div>' +
          '<div class="task-desc">' + esc(lugar) + (s.precio ? ' · ' + nf.format(s.precio) : '') + '</div>' +
        '</div>' +
        '<span class="task-vence">' + formatFechaCorta(s.creado_en.slice(0, 10)) + '</span>' +
      '</div>'
    );
  }

  var TIPO_LABEL_SOL = {
    departamento: 'Departamento', casa: 'Casa', 'casa-en-condominio': 'Casa en condominio',
    penthouse: 'Penthouse', loft: 'Loft', terreno: 'Terreno', oficina: 'Oficina',
    'local-comercial': 'Local comercial', desarrollo: 'Desarrollo',
  };

  function renderSolicitudes() {
    var lista = STATE.solicitudes;
    $('#solicitudesEmptyState').style.display = lista.length ? 'none' : 'block';
    $('#altaLinkTexto').textContent = location.origin + '/alta-propiedad/';
    $('#solicitudesLista').style.display = lista.length ? 'flex' : 'none';
    $('#solicitudesLista').innerHTML = lista.map(solRowHtml).join('');
    var nuevas = lista.filter(function (s) { return s.estado === 'nueva'; });
    $('#statSolicitudesNuevas').textContent = nuevas.length;
    $('#statSolicitudesRevisadas').textContent = lista.filter(function (s) { return s.estado === 'revisada' || s.estado === 'publicada'; }).length;
    $('#statSolicitudesTotal').textContent = lista.length;
    var badge = $('#tabSolicitudesBadge');
    badge.textContent = nuevas.length;
    badge.hidden = !nuevas.length;
  }

  function cargarSolicitudes() {
    sb.from('solicitudes_alta').select('*').neq('estado', 'descartada').order('creado_en', { ascending: false }).then(function (res) {
      if (res.error) { console.warn('[Panel] no se pudieron cargar las solicitudes:', res.error.message); return; }
      STATE.solicitudes = res.data || [];
      renderSolicitudes();
    });
  }

  function openSolModal(id) {
    var s = STATE.solicitudes.find(function (x) { return x.id === id; });
    if (!s) return;
    STATE.solEditando = s;
    var fotosHtml = (s.fotos || []).map(function (u) {
      return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="" style="width:76px;height:76px;object-fit:cover;border-radius:8px"></a>';
    }).join('');
    var SI_NO_LABEL = { si: 'Sí', no: 'No', no_se: 'No sabe / no dijo' };
    function legalLinea(label, valor, detalle) {
      return '<div class="field"><label>' + label + '</label><div>' + (SI_NO_LABEL[valor] || 'No sabe / no dijo') + (detalle ? ' — ' + esc(detalle) : '') + '</div></div>';
    }
    $('#solModalBody').innerHTML =
      '<div class="field-grid">' +
        '<div class="field"><label>Contacto</label><div>' + esc(s.nombre) + ' ' + esc(s.apellido || '') + '</div></div>' +
        '<div class="field"><label>Teléfono</label><div><a href="https://wa.me/52' + esc((s.telefono || '').replace(/\D/g, '')) + '" target="_blank" rel="noopener">' + esc(s.telefono) + '</a></div></div>' +
      '</div>' +
      (s.email ? '<div class="field"><label>Correo</label><div>' + esc(s.email) + '</div></div>' : '') +
      '<hr>' +
      '<div class="field-grid">' +
        '<div class="field"><label>Tipo / operación</label><div>' + esc(TIPO_LABEL_SOL[s.tipo] || s.tipo) + ' · ' + (s.operacion === 'renta' ? 'Renta' : 'Venta') + '</div></div>' +
        '<div class="field"><label>Precio</label><div>' + (s.precio ? nf.format(s.precio) : '—') + '</div></div>' +
      '</div>' +
      '<div class="field-grid-3">' +
        '<div class="field"><label>m² construcción</label><div>' + (s.m2c || '—') + '</div></div>' +
        '<div class="field"><label>m² terreno</label><div>' + (s.m2t || '—') + '</div></div>' +
        '<div class="field"><label>Antigüedad</label><div>' + (s.antig || 'Nueva') + '</div></div>' +
      '</div>' +
      '<div class="field-grid-3">' +
        '<div class="field"><label>Recámaras</label><div>' + (s.rec || '—') + '</div></div>' +
        '<div class="field"><label>Baños</label><div>' + (s.ban || '—') + '</div></div>' +
        '<div class="field"><label>Estacionamientos</label><div>' + (s.est || '—') + '</div></div>' +
      '</div>' +
      '<div class="field"><label>Ubicación (como la escribió)</label><div>' + esc([s.calle, s.numero].filter(Boolean).join(' ')) + ', ' + esc(s.colonia) + ', ' + esc(s.alcaldia) + (s.cp ? ' · CP ' + esc(s.cp) : '') + '</div></div>' +
      '<hr>' +
      '<div class="field-grid">' +
        legalLinea('Hipoteca', s.hipoteca, s.hipoteca_detalle) +
        legalLinea('Gravamen / embargo', s.gravamen, s.gravamen_detalle) +
      '</div>' +
      legalLinea('Deudas de administración o servicios', s.deuda_admin, s.deuda_admin_detalle) +
      (s.amenidades && s.amenidades.length ? '<div class="field"><label>Características</label><div>' + s.amenidades.map(function (a) { return esc(a); }).join(', ') + '</div></div>' : '') +
      (s.descripcion ? '<div class="field"><label>Descripción</label><div>' + esc(s.descripcion) + '</div></div>' : '') +
      (fotosHtml ? '<div class="field"><label>Fotos</label><div style="display:flex;gap:.4rem;flex-wrap:wrap">' + fotosHtml + '</div></div>' : '');
    $('#solModalBackdrop').classList.add('is-open');
  }

  function closeSolModal() {
    $('#solModalBackdrop').classList.remove('is-open');
  }

  function marcarEstadoSolicitud(id, estado) {
    return sb.from('solicitudes_alta').update({ estado: estado }).eq('id', id).then(function (res) {
      if (res.error) { toast('No se pudo actualizar: ' + res.error.message, 'err'); return; }
      cargarSolicitudes();
    });
  }

  function descartarSolicitud() {
    if (!STATE.solEditando) return;
    if (!confirm('¿Descartar esta solicitud? No se podrá deshacer.')) return;
    marcarEstadoSolicitud(STATE.solEditando.id, 'descartada');
    closeSolModal();
  }

  function usarSolicitud() {
    var s = STATE.solEditando;
    if (!s) return;
    closeSolModal();
    openModal(null);
    $('#f_detalle').value = [s.calle, s.numero, s.colonia].filter(Boolean).join(' ');
    $('#f_tipo').value = s.tipo || 'departamento';
    $('#f_precio').value = s.precio || '';
    $('#f_rec').value = s.rec || '';
    $('#f_ban').value = s.ban || '';
    $('#f_est').value = s.est || '';
    $('#f_m2c').value = s.m2c || '';
    $('#f_m2t').value = s.m2t || '';
    $('#f_descripcion').value = s.descripcion || '';
    setOperacion(s.operacion || 'venta');
    $$('input[name="amenidad"]').forEach(function (chk) {
      chk.checked = !!(s.amenidades && s.amenidades.indexOf(chk.value) !== -1);
    });
    STATE.fotos = (s.fotos || []).slice();
    renderPhotoStrip();
    toast('Revisa la colonia y el título antes de publicar — no se copiaron solos.');
    marcarEstadoSolicitud(s.id, 'revisada');
  }

  // ----------------------------------------------------- ESTIMADOR DE PRECIO
  // Digitaliza el estudio comparativo que Gio hacia a mano en Excel: combina
  // el inventario propio (calculado al vuelo contra assets/data/propiedades.json,
  // que ya trae precio_m2 de cada ficha publicada) con comparables externos
  // capturados a mano (liga, m2, precio... igual que el Excel). Ver
  // estudios_precio en schema.sql.
  var TIPO_LABEL_EST = { departamento: 'Departamento', casa: 'Casa', 'casa-en-condominio': 'Casa en condominio', penthouse: 'Penthouse', loft: 'Loft', terreno: 'Terreno', oficina: 'Oficina', 'local-comercial': 'Local comercial' };
  var INVENTARIO_PUBLICO_PROMESA = null;
  var MAX_COMPARABLES_CALCULO = 8;    // "mostrar 8 propiedades" -- si hay mas, se quedan las mas cercanas (radio) dentro de la zona
  // { promedio, promedioTrim, n, dias } -- promedio = simple (el que de verdad
  // usa Gio en su Excel para "Valor asignado"); promedioTrim = sin el mas
  // alto/bajo, solo como dato de referencia adicional.
  var ULTIMO_PROMEDIO_INVENTARIO = { promedio: 0, promedioTrim: 0, n: 0, dias: [] };
  var ULTIMO_PROMEDIO_COMPARABLES = { promedio: 0, promedioTrim: 0, n: 0, dias: [] };

  function promedioSimple(valores) {
    return valores.length ? valores.reduce(function (a, b) { return a + b; }, 0) / valores.length : 0;
  }

  // Promedio "recortado": quita el más alto y el más bajo antes de promediar
  // -- solo como referencia adicional (ver nota arriba), con 2 valores o
  // menos no tiene caso recortar, se promedia tal cual.
  function promedioTruncado(valores) {
    var ordenado = valores.slice().sort(function (a, b) { return a - b; });
    if (ordenado.length > 2) ordenado = ordenado.slice(1, -1);
    return promedioSimple(ordenado);
  }

  function diasDesde(fechaIso) {
    if (!fechaIso) return null;
    var f = new Date(fechaIso);
    if (isNaN(f.getTime())) return null;
    return Math.max(0, Math.round((Date.now() - f.getTime()) / 86400000));
  }

  function distanciaKm(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function cargarInventarioPublico() {
    if (!INVENTARIO_PUBLICO_PROMESA) {
      INVENTARIO_PUBLICO_PROMESA = fetch('../assets/data/propiedades.json')
        .then(function (r) { return r.json(); })
        .then(function (d) { return (d && d.propiedades) || []; })
        .catch(function () { return []; });
    }
    return INVENTARIO_PUBLICO_PROMESA;
  }

  function normalizaTexto(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function estudioRowHtml(e) {
    var lugar = [TIPO_LABEL_EST[e.tipo] || e.tipo, e.colonia].filter(Boolean).join(' en ');
    return (
      '<div class="task-row" data-open-est="' + e.id + '" style="cursor:pointer">' +
        '<div class="task-body">' +
          '<div class="task-titulo">' + esc(e.nombre || lugar) + ' — ' + (e.operacion === 'renta' ? 'Renta' : 'Venta') + '</div>' +
          '<div class="task-desc">' + esc(lugar || 'Sin colonia') + (e.m2c ? ' · ' + e.m2c + ' m²' : '') + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderEstudios() {
    var lista = STATE.estudios;
    $('#estudiosEmptyState').style.display = lista.length ? 'none' : 'block';
    $('#estudiosLista').style.display = lista.length ? 'flex' : 'none';
    $('#estudiosLista').innerHTML = lista.map(estudioRowHtml).join('');
  }

  function cargarEstudios() {
    var esAdmin = STATE.perfil && STATE.perfil.rol === 'admin';
    var q = sb.from('estudios_precio').select('*').order('creado_en', { ascending: false });
    if (!esAdmin) q = q.eq('asesor_id', STATE.session.user.id);
    q.then(function (res) {
      if (res.error) { console.warn('[Panel] no se pudieron cargar los estudios de precio:', res.error.message); return; }
      STATE.estudios = res.data || [];
      renderEstudios();
    });
  }

  function leerComparablesDesdeDOM() {
    return $$('#estComparablesBody .est-comp-row').map(function (tr) {
      return {
        liga: tr.querySelector('.est-in-liga').value.trim(),
        ubicacion: tr.querySelector('.est-in-ubicacion').value.trim(),
        m2: Number(tr.querySelector('.est-in-m2').value) || 0,
        precio: Number(tr.querySelector('.est-in-precio').value) || 0,
        rec: Number(tr.querySelector('.est-in-rec').value) || 0,
        ban: Number(tr.querySelector('.est-in-ban').value) || 0,
        est: Number(tr.querySelector('.est-in-est').value) || 0,
        antig: Number(tr.querySelector('.est-in-antig').value) || 0,
        dias: Number(tr.querySelector('.est-in-dias').value) || 0,
      };
    });
  }

  function estFilaComparableHtml(c, i) {
    c = c || {};
    var precioM2 = (c.m2 && c.precio) ? Math.round(c.precio / c.m2) : '';
    return (
      '<tr class="est-comp-row" data-idx="' + i + '">' +
        '<td class="est-liga"><input type="url" class="est-in-liga" placeholder="https://…" value="' + esc(c.liga || '') + '"></td>' +
        '<td><input type="text" class="est-in-ubicacion" placeholder="Calle, colonia" value="' + esc(c.ubicacion || '') + '"></td>' +
        '<td><input type="number" min="0" class="est-in-m2" value="' + (c.m2 || '') + '"></td>' +
        '<td><input type="number" min="0" class="est-in-precio" value="' + (c.precio || '') + '"></td>' +
        '<td><input type="text" class="est-in-preciom2" value="' + (precioM2 ? nf.format(precioM2) : '') + '" readonly></td>' +
        '<td><input type="number" min="0" class="est-in-rec" value="' + (c.rec || '') + '"></td>' +
        '<td><input type="number" min="0" class="est-in-ban" value="' + (c.ban || '') + '"></td>' +
        '<td><input type="number" min="0" class="est-in-est" value="' + (c.est || '') + '"></td>' +
        '<td><input type="number" min="0" class="est-in-antig" value="' + (c.antig || '') + '"></td>' +
        '<td><input type="number" min="0" class="est-in-dias" value="' + (c.dias || '') + '"></td>' +
        '<td><button type="button" class="est-remove-btn" data-remove-idx="' + i + '" aria-label="Quitar">&times;</button></td>' +
      '</tr>'
    );
  }

  function renderComparablesTable(lista) {
    var box = $('#estComparablesBox');
    if (!lista.length) {
      box.innerHTML = '<div class="est-empty-hint">Todavía no agregas comparables externos.</div>';
      ULTIMO_PROMEDIO_COMPARABLES = { promedio: 0, promedioTrim: 0, n: 0, dias: [] };
      actualizarResumenEstudio();
      return;
    }
    box.innerHTML =
      '<div style="overflow-x:auto"><table class="est-table"><thead><tr>' +
        '<th>Liga</th><th>Ubicación</th><th>m²</th><th>Precio</th><th>$/m²</th><th>Rec</th><th>Baños</th><th>Coch</th><th>Antig.</th><th>Días</th><th></th>' +
      '</tr></thead><tbody id="estComparablesBody">' +
        lista.map(estFilaComparableHtml).join('') +
        '<tr class="est-row-avg"><td colspan="4">Promedio (' + lista.length + ')</td><td id="estCompAvgM2">—</td><td colspan="6"></td></tr>' +
      '</tbody></table></div>';
    actualizarPromedioComparablesDOM();
  }

  function actualizarPromedioComparablesDOM() {
    $$('#estComparablesBody .est-comp-row').forEach(function (tr) {
      var m2 = Number(tr.querySelector('.est-in-m2').value) || 0;
      var precio = Number(tr.querySelector('.est-in-precio').value) || 0;
      tr.querySelector('.est-in-preciom2').value = (m2 && precio) ? nf.format(Math.round(precio / m2)) : '';
    });
    var validas = leerComparablesDesdeDOM().filter(function (f) { return f.m2 > 0 && f.precio > 0; }).slice(0, MAX_COMPARABLES_CALCULO);
    var valoresM2 = validas.map(function (f) { return f.precio / f.m2; });
    var promedio = promedioSimple(valoresM2);
    var promedioTrim = promedioTruncado(valoresM2);
    var dias = validas.filter(function (f) { return f.dias > 0; }).map(function (f) { return f.dias; });
    ULTIMO_PROMEDIO_COMPARABLES = { promedio: promedio, promedioTrim: promedioTrim, n: validas.length, dias: dias };
    var avgEl = $('#estCompAvgM2');
    if (avgEl) avgEl.textContent = promedio ? nf.format(Math.round(promedio)) + '/m²' : '—';
    var avgRow = $('#estComparablesBody .est-row-avg td:first-child');
    if (avgRow) avgRow.textContent = 'Promedio (' + validas.length + ')' + (validas.length > 2 ? ' · sin extremos: ' + nf.format(Math.round(promedioTrim)) + '/m²' : '');
    actualizarResumenEstudio();
  }

  function recalcularInventarioEstudio() {
    var tipo = $('#est_tipo').value;
    var operacion = $('#est_operacion').value;
    var colonia = normalizaTexto($('#est_colonia').value);
    var box = $('#estInventarioBox');
    if (!colonia) {
      box.innerHTML = '<div class="est-empty-hint">Escribe una colonia para comparar contra tu inventario.</div>';
      ULTIMO_PROMEDIO_INVENTARIO = { promedio: 0, promedioTrim: 0, n: 0, dias: [] };
      actualizarResumenEstudio();
      return;
    }
    cargarInventarioPublico().then(function (props) {
      var todoElMatch = props.filter(function (p) {
        return p.operacion === operacion && p.tipo === tipo && normalizaTexto(p.colonia_nombre).indexOf(colonia) !== -1;
      });
      // Máximo 8 comparables -- si hay más, nos quedamos con los más
      // cercanos entre sí (centro del propio grupo encontrado), como un
      // radio dentro de la misma zona/categoría en vez de tomarlos al azar.
      var match = todoElMatch;
      if (todoElMatch.length > MAX_COMPARABLES_CALCULO) {
        var conCoords = todoElMatch.filter(function (p) { return p.lat && p.lng; });
        if (conCoords.length) {
          var centroLat = promedioSimple(conCoords.map(function (p) { return p.lat; }));
          var centroLng = promedioSimple(conCoords.map(function (p) { return p.lng; }));
          match = todoElMatch.slice().sort(function (a, b) {
            var da = (a.lat && a.lng) ? distanciaKm(a.lat, a.lng, centroLat, centroLng) : Infinity;
            var db = (b.lat && b.lng) ? distanciaKm(b.lat, b.lng, centroLat, centroLng) : Infinity;
            return da - db;
          }).slice(0, MAX_COMPARABLES_CALCULO);
        } else {
          match = todoElMatch.slice(0, MAX_COMPARABLES_CALCULO);
        }
      }
      var conPrecioM2 = match.filter(function (p) { return p.precio_m2 > 0; });
      var valoresM2 = conPrecioM2.map(function (p) { return p.precio_m2; });
      var promedio = promedioSimple(valoresM2);
      var promedioTrim = promedioTruncado(valoresM2);
      var dias = match.map(function (p) { return diasDesde(p.publicado); }).filter(function (d) { return d != null; });
      ULTIMO_PROMEDIO_INVENTARIO = { promedio: promedio, promedioTrim: promedioTrim, n: conPrecioM2.length, dias: dias };
      if (!todoElMatch.length) {
        box.innerHTML = '<div class="est-empty-hint">No tienes propiedades publicadas en "' + esc($('#est_colonia').value) + '" con ese tipo y operación.</div>';
      } else {
        box.innerHTML =
          '<div style="overflow-x:auto"><table class="est-table"><thead><tr><th>Propiedad</th><th>m²</th><th>Precio</th><th>$/m²</th><th>Días</th></tr></thead><tbody>' +
          match.map(function (p) {
            var d = diasDesde(p.publicado);
            return '<tr><td><a href="../' + esc(p.url || '') + '" target="_blank" rel="noopener">' + esc(p.titulo) + '</a></td><td>' + (p.m2c || '—') + '</td><td>' + nf.format(p.precio) + '</td><td>' + (p.precio_m2 ? nf.format(Math.round(p.precio_m2)) : '—') + '</td><td>' + (d == null ? '—' : d) + '</td></tr>';
          }).join('') +
          '<tr class="est-row-avg"><td colspan="3">Promedio (' + conPrecioM2.length + (todoElMatch.length > MAX_COMPARABLES_CALCULO ? ' de ' + todoElMatch.length + ' encontrados, los más cercanos' : '') + ')' + (conPrecioM2.length > 2 ? ' · sin extremos: ' + nf.format(Math.round(promedioTrim)) + '/m²' : '') + '</td><td>' + (promedio ? nf.format(Math.round(promedio)) + '/m²' : '—') + '</td><td></td></tr>' +
          '</tbody></table></div>';
      }
      actualizarResumenEstudio();
    });
  }

  function actualizarResumenEstudio() {
    var m2c = Number($('#est_m2c').value) || 0;
    var box = $('#estResumenBox');
    var promInv = ULTIMO_PROMEDIO_INVENTARIO.promedio;
    var promComp = ULTIMO_PROMEDIO_COMPARABLES.promedio;
    var fuentes = [];
    if (promInv) fuentes.push(promInv);
    if (promComp) fuentes.push(promComp);
    var promCombinado = fuentes.length ? promedioSimple(fuentes) : 0;

    var dias = ULTIMO_PROMEDIO_INVENTARIO.dias.concat(ULTIMO_PROMEDIO_COMPARABLES.dias);
    var diasProm = dias.length ? Math.round(promedioSimple(dias)) : null;

    function card(lbl, valor, destacada) {
      return '<div class="est-resumen-card' + (destacada ? ' est-destacada' : '') + '"><div class="lbl">' + lbl + '</div><div class="num">' + valor + '</div></div>';
    }
    if (!m2c || !fuentes.length) {
      box.innerHTML = '<div class="est-empty-hint">Completa los m² y al menos un comparable (propio o externo) para ver el precio estimado.</div>';
      return;
    }

    var valorAsignado = promCombinado * m2c;
    var factorNegPct = Math.max(0, Number($('#est_propiedades_mercado').value) || 0) / 100;
    var factorPublicarPct = Math.max(0, Math.min(100, Number($('#est_factor_publicar').value) || 0)) / 100;
    var factorNegociacion = valorAsignado * factorNegPct;
    var precioCierre = valorAsignado - factorNegociacion;
    var precioSugeridoPublicar = valorAsignado - factorPublicarPct * factorNegociacion;

    box.innerHTML = '<div class="est-resumen">' +
      card('Valor asignado', nf.format(Math.round(valorAsignado)), true) +
      card('Precio sugerido a publicar', nf.format(Math.round(precioSugeridoPublicar))) +
      card('Precio estimado de cierre', nf.format(Math.round(precioCierre))) +
    '</div>' +
    '<div class="field-hint" style="margin-top:.5rem">' +
      'Promedio simple $/m²: ' + nf.format(Math.round(promCombinado)) + ' (tu inventario: ' + (promInv ? nf.format(Math.round(promInv)) : '—') + (promComp ? ', externos: ' + nf.format(Math.round(promComp)) : '') + ')' +
      (factorNegPct ? ' · Factor de negociación: ' + Math.round(factorNegPct * 100) + '% (' + nf.format(Math.round(factorNegociacion)) + ')' : ' · Escribe cuántas propiedades similares hay en el mercado para calcular el factor de negociación') +
      (diasProm != null ? ' · Promedio de ' + diasProm + ' días publicados' : '') +
    '</div>';
  }

  function llenarColoniasDatalist() {
    cargarInventarioPublico().then(function (props) {
      var vistos = {};
      var opciones = [];
      props.forEach(function (p) {
        if (p.colonia_nombre && !vistos[p.colonia_nombre]) { vistos[p.colonia_nombre] = true; opciones.push(p.colonia_nombre); }
      });
      opciones.sort();
      $('#est_colonia_list').innerHTML = opciones.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
    });
  }

  function setOperacionEstudio(op) {
    $$('#estOpToggle button').forEach(function (b) { b.classList.toggle('is-active', b.dataset.op === op); });
    $('#est_operacion').value = op;
    recalcularInventarioEstudio();
  }

  function abrirEstudioModal(id) {
    var e = id ? STATE.estudios.filter(function (x) { return x.id === id; })[0] : null;
    STATE.estudioEditando = e || null;
    $('#estudioModalTitle').textContent = e ? 'Editar estudio' : 'Nuevo estudio de precio';
    $('#estudioError').classList.remove('show');
    $('#est_nombre').value = e ? (e.nombre || '') : '';
    $('#est_tipo').value = e ? e.tipo : 'departamento';
    $('#est_colonia').value = e ? (e.colonia || '') : '';
    $('#est_m2c').value = e && e.m2c ? e.m2c : '';
    $('#est_propiedades_mercado').value = e && e.propiedades_mercado ? e.propiedades_mercado : '';
    $('#est_factor_publicar').value = e && e.factor_publicar != null ? e.factor_publicar : 55;
    $('#est_notas').value = e ? (e.notas || '') : '';
    setOperacionEstudio(e ? e.operacion : 'venta');
    renderComparablesTable((e && e.comparables) || []);
    $('#estDeleteBtn').style.display = e ? 'inline-flex' : 'none';
    $('#estudioModalBackdrop').classList.add('is-open');
    llenarColoniasDatalist();
  }

  function cerrarEstudioModal() {
    $('#estudioModalBackdrop').classList.remove('is-open');
  }

  function guardarEstudio() {
    var errBox = $('#estudioError');
    errBox.classList.remove('show');
    var data = {
      nombre: $('#est_nombre').value.trim(),
      operacion: $('#est_operacion').value,
      tipo: $('#est_tipo').value,
      colonia: $('#est_colonia').value.trim(),
      m2c: Number($('#est_m2c').value) || 0,
      propiedades_mercado: Number($('#est_propiedades_mercado').value) || 0,
      factor_publicar: Number($('#est_factor_publicar').value) || 55,
      comparables: leerComparablesDesdeDOM(),
      notas: $('#est_notas').value.trim(),
    };
    var btn = $('#estSaveBtn');
    setBusy(btn, true, 'Guardando…');
    var query = STATE.estudioEditando
      ? sb.from('estudios_precio').update(data).eq('id', STATE.estudioEditando.id)
      : sb.from('estudios_precio').insert(Object.assign({ asesor_id: STATE.session.user.id }, data));
    query.then(function (res) {
      setBusy(btn, false);
      if (res.error) {
        errBox.textContent = 'No se pudo guardar: ' + res.error.message;
        errBox.classList.add('show');
        return;
      }
      cerrarEstudioModal();
      toast('Estudio guardado');
      cargarEstudios();
    });
  }

  function eliminarEstudio() {
    if (!STATE.estudioEditando) return;
    if (!confirm('¿Eliminar este estudio de precio?')) return;
    sb.from('estudios_precio').delete().eq('id', STATE.estudioEditando.id).then(function (res) {
      if (res.error) { toast('No se pudo eliminar: ' + res.error.message, 'err'); return; }
      cerrarEstudioModal();
      toast('Estudio eliminado');
      cargarEstudios();
    });
  }

  // Junta todo lo que se ve en pantalla (formulario + promedios ya
  // calculados) en un solo objeto -- lo usan tanto la exportación a Excel
  // como la de PDF, así ninguna de las dos se desincroniza de lo que
  // realmente calculó actualizarResumenEstudio().
  function recopilarDatosReporte() {
    var m2c = Number($('#est_m2c').value) || 0;
    var promInv = ULTIMO_PROMEDIO_INVENTARIO.promedio;
    var promComp = ULTIMO_PROMEDIO_COMPARABLES.promedio;
    var fuentes = [];
    if (promInv) fuentes.push(promInv);
    if (promComp) fuentes.push(promComp);
    var promCombinado = fuentes.length ? promedioSimple(fuentes) : 0;
    var valorAsignado = promCombinado * m2c;
    var propiedadesMercado = Math.max(0, Number($('#est_propiedades_mercado').value) || 0);
    var factorNegPct = propiedadesMercado / 100;
    var factorPublicarPct = Math.max(0, Math.min(100, Number($('#est_factor_publicar').value) || 0)) / 100;
    var factorNegociacion = valorAsignado * factorNegPct;
    return {
      nombre: $('#est_nombre').value.trim() || 'Estudio de precio',
      operacion: $('#est_operacion').value,
      tipo: TIPO_LABEL_EST[$('#est_tipo').value] || $('#est_tipo').value,
      colonia: $('#est_colonia').value.trim(),
      m2c: m2c,
      comparables: leerComparablesDesdeDOM(),
      promInv: promInv,
      promComp: promComp,
      promCombinado: promCombinado,
      valorAsignado: valorAsignado,
      propiedadesMercado: propiedadesMercado,
      factorNegPct: factorNegPct,
      factorNegociacion: factorNegociacion,
      factorPublicarPct: factorPublicarPct,
      precioCierre: valorAsignado - factorNegociacion,
      precioSugeridoPublicar: valorAsignado - factorPublicarPct * factorNegociacion,
      asesor: (STATE.perfil && STATE.perfil.nombre) || (STATE.session && STATE.session.user.email) || '',
      fecha: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
  }

  function csvEsc(v) {
    var s = String(v == null ? '' : v);
    if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function descargarArchivo(nombre, contenido, tipo) {
    var blob = new Blob([contenido], { type: tipo });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportarEstudioExcel() {
    var d = recopilarDatosReporte();
    var opLabel = d.operacion === 'renta' ? 'Renta' : 'Venta';
    var filas = [];
    filas.push(['Unidades', 'Liga', 'Ubicación', 'Inmueble', 'Operación', 'Metros habitables', 'Precio publicado', 'Precio por metro', 'Habitaciones', 'Baños', 'Cocheras', 'Antigüedad', 'Días publicado']);
    d.comparables.forEach(function (c, i) {
      var pm2 = (c.m2 && c.precio) ? Math.round(c.precio / c.m2) : '';
      filas.push([i + 1, c.liga, c.ubicacion, d.tipo, opLabel, c.m2 || '', c.precio || '', pm2, c.rec || '', c.ban || '', c.est || '', c.antig || '', c.dias || '']);
    });
    filas.push([]);
    filas.push(['Promedio simple', '', '', '', '', '', '', Math.round(d.promComp || d.promInv || 0)]);
    filas.push([]);
    filas.push(['Datos de la propiedad', '', d.colonia, d.tipo, opLabel, d.m2c]);
    filas.push([]);
    filas.push(['Valor asignado a la propiedad', '', '', '', '', Math.round(d.valorAsignado)]);
    filas.push(['Propiedades similares en el mercado', d.propiedadesMercado]);
    filas.push(['Factor de negociación', '', '', '', '', Math.round(d.factorNegociacion), '', d.factorNegPct]);
    filas.push(['Precio sugerido a publicar', '', '', '', '', Math.round(d.precioSugeridoPublicar)]);
    filas.push(['Precio estimado de cierre', '', '', '', '', Math.round(d.precioCierre)]);
    filas.push([]);
    filas.push(['Estudio realizado por', d.asesor]);
    filas.push(['Fecha', d.fecha]);
    var csv = filas.map(function (fila) { return fila.map(csvEsc).join(','); }).join('\r\n');
    var nombreArchivo = (d.nombre || 'estudio-precio').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.csv';
    descargarArchivo(nombreArchivo, '﻿' + csv, 'text/csv;charset=utf-8;');
  }

  function exportarEstudioPDF() {
    var d = recopilarDatosReporte();
    var opLabel = d.operacion === 'renta' ? 'renta' : 'venta';
    var filasHtml = d.comparables.map(function (c, i) {
      var pm2 = (c.m2 && c.precio) ? Math.round(c.precio / c.m2) : '';
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(c.ubicacion) + '</td><td>' + (c.m2 || '') + '</td><td>' + (c.precio ? nf.format(c.precio) : '') + '</td><td>' + (pm2 ? nf.format(pm2) : '') + '</td><td>' + (c.rec || '') + '</td><td>' + (c.ban || '') + '</td><td>' + (c.est || '') + '</td><td>' + (c.antig || '') + '</td><td>' + (c.dias || '') + '</td></tr>';
    }).join('');
    var html = '<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>' + esc(d.nombre) + '</title><style>' +
      'body{font-family:Georgia,serif;color:#0E1626;max-width:900px;margin:2rem auto;padding:0 1rem}' +
      'h1{font-size:1.4rem;color:#071F4A;margin-bottom:.2rem} h2{font-size:1rem;color:#071F4A;margin-top:2rem;border-bottom:1px solid #ccc;padding-bottom:.3rem}' +
      'table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:.5rem} th,td{border:1px solid #ddd;padding:.4rem .5rem;text-align:left}' +
      'th{background:#f2f4f9} .resumen{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-top:1rem}' +
      '.tarjeta{background:#f2f4f9;padding:.8rem;border-radius:8px} .tarjeta .lbl{font-size:.7rem;text-transform:uppercase;color:#737E92} .tarjeta .num{font-size:1.1rem;font-weight:bold;color:#071F4A}' +
      '.footer{margin-top:3rem;font-size:.85rem;color:#4A5468}' +
      '</style></head><body>' +
      '<h1>' + esc(d.nombre) + '</h1>' +
      '<p>' + esc(d.tipo) + ' en ' + opLabel + (d.colonia ? ' — ' + esc(d.colonia) : '') + (d.m2c ? ' · ' + d.m2c + ' m²' : '') + '</p>' +
      (filasHtml ? '<h2>Comparables</h2><table><thead><tr><th>#</th><th>Ubicación</th><th>m²</th><th>Precio</th><th>$/m²</th><th>Rec</th><th>Baños</th><th>Coch</th><th>Antig.</th><th>Días</th></tr></thead><tbody>' + filasHtml + '</tbody></table>' : '') +
      '<h2>Resumen</h2><div class="resumen">' +
        '<div class="tarjeta"><div class="lbl">Valor asignado</div><div class="num">' + nf.format(Math.round(d.valorAsignado)) + '</div></div>' +
        '<div class="tarjeta"><div class="lbl">Precio sugerido a publicar</div><div class="num">' + nf.format(Math.round(d.precioSugeridoPublicar)) + '</div></div>' +
        '<div class="tarjeta"><div class="lbl">Precio estimado de cierre</div><div class="num">' + nf.format(Math.round(d.precioCierre)) + '</div></div>' +
      '</div>' +
      '<p style="margin-top:1rem;font-size:.85rem;color:#4A5468">Factor de negociación: ' + Math.round(d.factorNegPct * 100) + '% (' + nf.format(Math.round(d.factorNegociacion)) + '), basado en ' + d.propiedadesMercado + ' propiedades similares en el mercado.</p>' +
      '<div class="footer">Estudio realizado por ' + esc(d.asesor) + '<br>' + esc(d.fecha) + '</div>' +
      '</body></html>';
    var w = window.open('', '_blank');
    if (!w) { toast('Habilita las ventanas emergentes para exportar a PDF', 'err'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 300);
  }

  // --------------------------------------------------------------- EQUIPO (solo admin)
  function contarPropiedadesActivas(asesorId) {
    return STATE.propiedades.filter(function (p) { return p.asesor_id === asesorId && p.estado === 'disponible'; }).length;
  }

  var ROL_LABEL = { admin: 'Admin', asesor: 'Asesor', administrativo: 'Administrativo' };

  function rolOptionsHtml(rolActual) {
    return ['asesor', 'administrativo', 'admin'].map(function (r) {
      return '<option value="' + r + '"' + (r === rolActual ? ' selected' : '') + '>' + ROL_LABEL[r] + '</option>';
    }).join('');
  }

  function teamRowHtml(p) {
    var inicial = (p.nombre || p.email || '?').trim().charAt(0).toUpperCase();
    var esUnoMismo = !!(STATE.session && p.id === STATE.session.user.id);
    var n = contarPropiedadesActivas(p.id);
    return (
      '<div class="team-row' + (p.activo ? '' : ' is-inactivo') + '">' +
        '<div class="team-row-id">' +
          '<div class="avatar">' + esc(inicial) + '</div>' +
          '<div><div class="team-row-name">' + esc(p.nombre || 'Sin nombre') + '</div>' +
          '<div class="team-row-email">' + esc(p.email || '') + '</div></div>' +
        '</div>' +
        '<span class="team-row-props">' + n + ' propiedad' + (n === 1 ? '' : 'es') + ' activa' + (n === 1 ? '' : 's') + '</span>' +
        '<div class="team-row-actions">' +
          '<select class="team-role-select" data-rol-id="' + p.id + '"' + (esUnoMismo ? ' disabled title="No puedes cambiar tu propio rol"' : '') + '>' +
            rolOptionsHtml(p.rol) +
          '</select>' +
          '<label class="switch">' +
            '<input type="checkbox" data-activo-id="' + p.id + '"' + (p.activo ? ' checked' : '') + (esUnoMismo ? ' disabled title="No puedes desactivarte a ti mismo"' : '') + '>' +
            '<span class="switch-track"></span>' + (p.activo ? 'Activo' : 'Desactivado') +
          '</label>' +
        '</div>' +
      '</div>'
    );
  }

  // Un renglón "pendiente" es de `invitaciones` -- todavía no existe como
  // usuario real, así que no tiene rol-select ni switch de activo, solo
  // cancelar (borra el renglón de invitaciones, nunca podrá entrar).
  function invitacionRowHtml(inv) {
    var inicial = (inv.nombre || inv.email || '?').trim().charAt(0).toUpperCase();
    return (
      '<div class="team-row is-inactivo">' +
        '<div class="team-row-id">' +
          '<div class="avatar">' + esc(inicial) + '</div>' +
          '<div><div class="team-row-name">' + esc(inv.nombre || 'Sin nombre') + '</div>' +
          '<div class="team-row-email">' + esc(inv.email || '') + '</div></div>' +
        '</div>' +
        '<span class="team-row-badge is-pendiente">Invitación pendiente · ' + esc(ROL_LABEL[inv.rol] || inv.rol) + '</span>' +
        '<div class="team-row-actions">' +
          '<button class="btn btn--ghost btn--sm" data-cancelar-invitacion="' + esc(inv.email) + '">Cancelar invitación</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderEquipo() {
    $('#equipoLista').innerHTML =
      STATE.equipo.map(teamRowHtml).join('') +
      STATE.invitaciones.map(invitacionRowHtml).join('');
    $('#statAsesoresActivos').textContent = STATE.equipo.filter(function (p) { return p.activo; }).length;
    $('#statAsesoresInactivos').textContent = STATE.equipo.filter(function (p) { return !p.activo; }).length;
    $('#statInvitacionesPendientes').textContent = STATE.invitaciones.length;
  }

  function cargarEquipo() {
    Promise.all([
      sb.from('perfiles').select('*').order('creado_en', { ascending: true }),
      sb.from('invitaciones').select('*').order('creado_en', { ascending: true }),
    ]).then(function (res) {
      var perfilesRes = res[0], invRes = res[1];
      if (perfilesRes.error) console.warn('[Panel] no se pudo cargar el equipo:', perfilesRes.error.message);
      if (invRes.error) console.warn('[Panel] no se pudieron cargar las invitaciones:', invRes.error.message);
      STATE.equipo = perfilesRes.data || [];
      STATE.invitaciones = invRes.data || [];
      renderEquipo();
    });
  }

  function openInviteModal() {
    $('#inv_nombre').value = '';
    $('#inv_email').value = '';
    $('#inv_rol').value = 'asesor';
    $('#inviteError').classList.remove('show');
    $('#inviteModalBackdrop').classList.add('is-open');
  }

  function closeInviteModal() {
    $('#inviteModalBackdrop').classList.remove('is-open');
  }

  function enviarInvitacion() {
    var nombre = $('#inv_nombre').value.trim();
    var email = $('#inv_email').value.trim().toLowerCase();
    var rol = $('#inv_rol').value;
    var errBox = $('#inviteError');
    errBox.classList.remove('show');
    if (!email) {
      errBox.textContent = 'Ingresa un correo.';
      errBox.classList.add('show');
      return;
    }
    var yaEsDelEquipo = STATE.equipo.some(function (p) { return (p.email || '').toLowerCase() === email; });
    if (yaEsDelEquipo) {
      errBox.textContent = 'Ese correo ya es parte del equipo.';
      errBox.classList.add('show');
      return;
    }

    var btn = $('#inviteSendBtn');
    setBusy(btn, true, 'Guardando…');
    sb.from('invitaciones').insert({ nombre: nombre, email: email, rol: rol }).then(function (res) {
      setBusy(btn, false);
      if (res.error) {
        errBox.textContent = res.error.code === '23505'
          ? 'Ese correo ya está invitado.'
          : 'No se pudo invitar: ' + res.error.message;
        errBox.classList.add('show');
        return;
      }
      closeInviteModal();
      toast('Invitación guardada — puede entrar con Google en cuanto quiera');
      cargarEquipo();
    });
  }

  function cancelarInvitacion(email) {
    if (!confirm('¿Cancelar la invitación de ' + email + '?')) return;
    sb.from('invitaciones').delete().eq('email', email).then(function (res) {
      if (res.error) { toast('No se pudo cancelar: ' + res.error.message, 'err'); return; }
      toast('Invitación cancelada');
      cargarEquipo();
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

    $('#googleLoginBtn').addEventListener('click', handleGoogleLogin);
    $('#logoutBtn').addEventListener('click', handleLogout);
    $('#addPropBtn').addEventListener('click', function () { openModal(null); });
    $('#emptyAddBtn').addEventListener('click', function () { openModal(null); });
    $('#addPropBtnFab').addEventListener('click', function () { openModal(null); });

    $('#tabPropiedades').addEventListener('click', function () { setView('propiedades'); });
    $('#tabContactos').addEventListener('click', function () { setView('contactos'); });
    $('#tabTareas').addEventListener('click', function () { setView('tareas'); });
    $('#tabSolicitudes').addEventListener('click', function () { setView('solicitudes'); });
    $('#tabEstimador').addEventListener('click', function () { setView('estimador'); });
    $('#tabEquipo').addEventListener('click', function () { setView('equipo'); });

    $('#solicitudesLista').addEventListener('click', function (e) {
      var row = e.target.closest && e.target.closest('[data-open-sol]');
      if (row) openSolModal(row.dataset.openSol);
    });
    $('#solModalClose').addEventListener('click', closeSolModal);
    $('#solModalBackdrop').addEventListener('click', function (e) { if (e.target.id === 'solModalBackdrop') closeSolModal(); });
    $('#solDescartarBtn').addEventListener('click', descartarSolicitud);
    $('#solUsarBtn').addEventListener('click', usarSolicitud);

    $('#addEstudioBtn').addEventListener('click', function () { abrirEstudioModal(null); });
    $('#estudiosEmptyAddBtn').addEventListener('click', function () { abrirEstudioModal(null); });
    $('#estudiosLista').addEventListener('click', function (e) {
      var row = e.target.closest && e.target.closest('[data-open-est]');
      if (row) abrirEstudioModal(row.dataset.openEst);
    });
    $('#estudioModalClose').addEventListener('click', cerrarEstudioModal);
    $('#estudioModalCancelBtn').addEventListener('click', cerrarEstudioModal);
    $('#estudioModalBackdrop').addEventListener('click', function (e) { if (e.target.id === 'estudioModalBackdrop') cerrarEstudioModal(); });
    $$('#estOpToggle button').forEach(function (b) {
      b.addEventListener('click', function () { setOperacionEstudio(b.dataset.op); });
    });
    $('#est_tipo').addEventListener('change', recalcularInventarioEstudio);
    $('#est_colonia').addEventListener('input', recalcularInventarioEstudio);
    $('#est_m2c').addEventListener('input', actualizarResumenEstudio);
    $('#est_propiedades_mercado').addEventListener('input', actualizarResumenEstudio);
    $('#est_factor_publicar').addEventListener('input', actualizarResumenEstudio);
    $('#estAddComparableBtn').addEventListener('click', function () {
      var lista = leerComparablesDesdeDOM();
      lista.push({});
      renderComparablesTable(lista);
    });
    $('#estComparablesBox').addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-remove-idx]')) {
        var lista = leerComparablesDesdeDOM();
        var idx = Number(e.target.closest('[data-remove-idx]').dataset.removeIdx);
        lista.splice(idx, 1);
        renderComparablesTable(lista);
      }
    });
    $('#estComparablesBox').addEventListener('input', function (e) {
      if (e.target.classList.contains('est-in-m2') || e.target.classList.contains('est-in-precio')) {
        actualizarPromedioComparablesDOM();
      }
    });
    $('#estSaveBtn').addEventListener('click', guardarEstudio);
    $('#estDeleteBtn').addEventListener('click', eliminarEstudio);
    $('#estExportExcelBtn').addEventListener('click', exportarEstudioExcel);
    $('#estExportPdfBtn').addEventListener('click', exportarEstudioPDF);

    $('#addTareaBtn').addEventListener('click', openTareaModal);
    $('#tareasEmptyAddBtn').addEventListener('click', openTareaModal);
    $('#tareaModalClose').addEventListener('click', closeTareaModal);
    $('#tareaModalBackdrop').addEventListener('click', function (e) { if (e.target.id === 'tareaModalBackdrop') closeTareaModal(); });
    $('#tareaGuardarBtn').addEventListener('click', guardarTarea);
    $('#tareasLista').addEventListener('click', function (e) {
      var toggleId = e.target.closest && e.target.closest('[data-toggle-tarea]');
      var delId = e.target.closest && e.target.closest('[data-del-tarea]');
      if (toggleId) toggleTarea(toggleId.dataset.toggleTarea);
      else if (delId) eliminarTarea(delId.dataset.delTarea);
    });

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
    $('#equipoLista').addEventListener('click', function (e) {
      var email = e.target.dataset.cancelarInvitacion;
      if (email) cancelarInvitacion(email);
    });

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

    if (mostrarErrorDeAuthSiHay()) return;

    sb.auth.getSession().then(function (res) {
      STATE.session = res.data.session;
      if (STATE.session) cargarPerfilYMostrar();
    });
  });
})();
