/* ==========================================================================
   Gio Filio — Tu espacio ideal
   Núcleo de la aplicación: búsqueda, filtros, mapa, favoritos, comparador,
   formularios, analítica (dataLayer GA4/GTM).
   Sin dependencias externas. Funciona sobre file:// y sobre servidor HTTP.
   ========================================================================== */
(function () {
  'use strict';

  // ----------------------------------------------------------- CONFIG
  var CFG = window.GF_CONFIG || (window.GF_CONFIG = {});
  var BASE = window.GF_BASE || './';
  var D = window.GF_DATA || { propiedades: [], colonias: [], alcaldias: [] };

  var LS = {
    fav: 'gf_favoritos_v1',
    cmp: 'gf_comparador_v1',
    leads: 'gf_leads_v1',
    filtros: 'gf_ultimos_filtros_v1'
  };
  var MAX_CMP = 3;

  // ------------------------------------------------------------ UTILS
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function on(el, ev, fn, o) { if (el) el.addEventListener(ev, fn, o); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function url(p) {
    if (!p) return BASE;
    if (/^(https?:|mailto:|tel:|#)/.test(p)) return p;
    return BASE + String(p).replace(/^\//, '');
  }
  function store(k, def) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ }
  }
  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 200); };
  }

  var nfMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  var nfNum = new Intl.NumberFormat('es-MX');
  function money(n) { return nfMXN.format(n || 0).replace('$', '$'); }
  function moneyShort(n) {
    n = Number(n) || 0;
    if (n >= 1e6) { var m = n / 1e6; return '$' + (m >= 10 ? m.toFixed(1) : m.toFixed(2)).replace(/\.?0+$/, '') + ' M'; }
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + ' K';
    return '$' + nfNum.format(n);
  }
  function num(n) { return nfNum.format(Math.round(Number(n) || 0)); }

  // ------------------------------------------------------- ANALÍTICA
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    var payload = Object.assign({ event: event }, params || {});
    window.dataLayer.push(payload);
    if (CFG.debug) console.log('[dataLayer]', payload);
  }
  window.gfTrack = track;

  function propParams(p, extra) {
    if (!p) return extra || {};
    return Object.assign({
      property_id: p.id,
      property_title: p.titulo,
      property_type: p.tipo,
      operation: p.operacion,
      price: p.precio,
      currency: 'MXN',
      colonia: p.colonia_nombre,
      alcaldia: p.alcaldia_nombre,
      city: 'Ciudad de México',
      m2: p.m2c || p.m2t
    }, extra || {});
  }
  window.gfPropParams = propParams;

  // ------------------------------------------------------------ TOAST
  var toastEl, toastT;
  function toast(msg, icon) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = (icon || ICON.check) + '<span>' + esc(msg) + '</span>';
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2800);
  }
  window.gfToast = toast;

  // ------------------------------------------------------------ ICONOS
  var ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 7.5 2.9c0 5.3-7.5 10-7.5 10z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 21s-6.5-5.7-6.5-10a6.5 6.5 0 1 1 13 0c0 4.3-6.5 10-6.5 10z"/><circle cx="12" cy="11" r="2.4"/></svg>',
    bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 18h18M3 18v2M21 18v2M7 11V8a1 1 0 0 1 1-1h3v4"/></svg>',
    bath: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3zM6 12V6a2 2 0 0 1 3.4-1.4M7 19l-1 2M17 19l1 2"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 13l1.6-4.3A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.7L19 13M4 13h16v4H4zM7 17v2M17 17v2"/><circle cx="7.5" cy="15" r="1"/><circle cx="16.5" cy="15" r="1"/></svg>',
    area: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9h16M9 4v16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13"/></svg>'
  };
  window.GF_ICON = ICON;

  // ============================================================ HEADER
  function initHeader() {
    var h = $('.site-header');
    if (h) {
      var onScroll = function () { h.classList.toggle('is-stuck', window.scrollY > 8); };
      onScroll(); on(window, 'scroll', onScroll, { passive: true });
    }
    var nav = $('#mobileNav');
    function setNav(open) {
      if (!nav) return;
      nav.classList.toggle('is-open', open);
      nav.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.classList.toggle('no-scroll', open);
      var b = $('#burger'); if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var f = nav.querySelector('a,button'); if (f) f.focus(); }
    }
    on($('#burger'), 'click', function () { setNav(true); });
    on($('#mobileNavClose'), 'click', function () { setNav(false); $('#burger') && $('#burger').focus(); });
    on(document, 'keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (nav && nav.classList.contains('is-open')) setNav(false);
      var lb = $('#lightbox'); if (lb && lb.classList.contains('is-open')) closeLightbox();
      var dr = $('.drawer.is-open'); if (dr) closeDrawer(dr);
    });
  }

  // ========================================================== FAVORITOS
  function favs() { return store(LS.fav, []); }
  function isFav(id) { return favs().indexOf(id) > -1; }
  function toggleFav(id) {
    var f = favs(), i = f.indexOf(id), added = i < 0;
    if (added) f.push(id); else f.splice(i, 1);
    save(LS.fav, f);
    syncFavUI();
    var p = byId(id);
    track('favorite_property', propParams(p, { action: added ? 'add' : 'remove', favorites_count: f.length }));
    toast(added ? 'Guardada en favoritos' : 'Quitada de favoritos', added ? ICON.heart : ICON.check);
    return added;
  }
  function syncFavUI() {
    var f = favs();
    $$('[data-fav-count]').forEach(function (el) {
      el.textContent = f.length; el.setAttribute('data-count', f.length);
    });
    $$('.pcard-fav').forEach(function (b) {
      var on_ = f.indexOf(b.dataset.id) > -1;
      b.classList.toggle('is-on', on_);
      b.setAttribute('aria-pressed', on_ ? 'true' : 'false');
      b.setAttribute('aria-label', (on_ ? 'Quitar de' : 'Guardar en') + ' favoritos');
    });
  }
  window.gfFavs = favs;

  // ========================================================= COMPARADOR
  function cmps() { return store(LS.cmp, []); }
  function toggleCmp(id) {
    var c = cmps(), i = c.indexOf(id);
    if (i > -1) { c.splice(i, 1); }
    else {
      if (c.length >= MAX_CMP) { toast('Puedes comparar hasta ' + MAX_CMP + ' propiedades'); syncCmpUI(); return false; }
      c.push(id);
    }
    save(LS.cmp, c); syncCmpUI();
    track('compare_property', propParams(byId(id), { action: i > -1 ? 'remove' : 'add', compare_count: c.length }));
    return i < 0;
  }
  function syncCmpUI() {
    var c = cmps();
    $$('[data-cmp-count]').forEach(function (el) { el.textContent = c.length; });
    $$('.pcard-cmp input').forEach(function (inp) {
      inp.checked = c.indexOf(inp.dataset.id) > -1;
      inp.disabled = !inp.checked && c.length >= MAX_CMP;
    });
    var bar = $('#cmpBar');
    if (bar) {
      bar.classList.toggle('is-on', c.length > 0);
      var t = $('.cb-txt', bar);
      if (t) t.textContent = c.length + (c.length === 1 ? ' propiedad seleccionada' : ' propiedades seleccionadas');
    }
  }
  window.gfCmps = cmps;

  // ============================================================== DATOS
  var INDEX = {};
  (D.propiedades || []).forEach(function (p) { INDEX[p.id] = p; });
  function byId(id) { return INDEX[id]; }
  window.gfById = byId;

  function precioM2(p) {
    var m = p.m2c || p.m2t; if (!m) return 0;
    return p.operacion === 'venta' ? Math.round(p.precio / m) : Math.round(p.precio / m);
  }

  // -------------------------------------------------------- PROPERTY CARD
  function cardHTML(p, opts) {
    opts = opts || {};
    var href = url(p.url);
    var badges = '<span class="badge badge--' + p.operacion + '">' + (p.operacion === 'venta' ? 'Venta' : 'Renta') + '</span>';
    (p.badges || []).forEach(function (b) {
      badges += '<span class="badge badge--' + b + '">' + esc(BADGE_LABEL[b] || b) + '</span>';
    });
    var specs = [];
    if (p.rec) specs.push('<span>' + p.rec + ' rec</span>');
    if (p.ban) specs.push('<span>' + p.ban + (p.medios ? '.' + p.medios : '') + ' baños</span>');
    if (p.est) specs.push('<span>' + p.est + ' est</span>');
    if (p.m2c) specs.push('<span>' + num(p.m2c) + ' m²</span>');
    else if (p.m2t) specs.push('<span>' + num(p.m2t) + ' m² terreno</span>');

    var precio = p.operacion === 'renta'
      ? money(p.precio) + '<span class="per"> /mes</span>'
      : money(p.precio);

    return '' +
      '<article class="pcard" data-id="' + esc(p.id) + '">' +
        '<a class="pcard-link" href="' + href + '" data-track-select="' + esc(p.id) + '" aria-label="Ver ' + esc(p.titulo) + '"></a>' +
        '<div class="pcard-media">' +
          '<img src="' + url(p.foto_card) + '" alt="' + esc(p.titulo) + ' — ' + esc(p.colonia_nombre) + ', ' + esc(p.alcaldia_nombre) + ', Ciudad de México" loading="lazy" decoding="async" width="640" height="480">' +
          '<div class="pcard-badges">' + badges + '</div>' +
          '<button type="button" class="pcard-fav" data-id="' + esc(p.id) + '" aria-pressed="false" aria-label="Guardar en favoritos">' + ICON.heart + '</button>' +
        '</div>' +
        '<div class="pcard-body">' +
          '<div class="pcard-price">' + precio + ' <span class="cur">MXN</span></div>' +
          '<h3 class="pcard-title">' + esc(p.titulo) + '</h3>' +
          '<p class="pcard-loc">' + ICON.pin + esc(p.colonia_nombre) + ', ' + esc(p.alcaldia_nombre) + ', CDMX</p>' +
          '<div class="pcard-specs">' + specs.join('') + '</div>' +
        '</div>' +
        (opts.noCmp ? '' :
        '<label class="pcard-cmp"><input type="checkbox" data-id="' + esc(p.id) + '"> Comparar</label>') +
        '<div class="pcard-actions">' +
          '<a class="btn btn--ghost btn--sm" href="' + href + '">Ver propiedad</a>' +
          '<a class="btn btn--sm" href="' + waLink(p) + '" target="_blank" rel="noopener" data-wa="' + esc(p.id) + '">Contactar a Gio</a>' +
        '</div>' +
      '</article>';
  }
  window.gfCardHTML = cardHTML;

  var BADGE_LABEL = {
    nueva: 'Nueva', exclusiva: 'Exclusiva', oportunidad: 'Oportunidad',
    preventa: 'Preventa', 'entrega-inmediata': 'Entrega inmediata'
  };

  function waLink(p) {
    var t;
    if (p) {
      t = 'Hola Gio, estoy interesado en ' + p.titulo_wa + ' con ID ' + p.id + '. ¿Podrías darme más información?';
    } else {
      t = 'Hola Gio, me gustaría recibir asesoría para encontrar mi espacio ideal en CDMX.';
    }
    return 'https://wa.me/' + (CFG.whatsapp || '5215562255840') + '?text=' + encodeURIComponent(t);
  }
  window.gfWaLink = waLink;

  // ------------------------------------------------ delegación de eventos
  function initDelegation() {
    on(document, 'click', function (e) {
      var fav = e.target.closest && e.target.closest('.pcard-fav');
      if (fav) { e.preventDefault(); e.stopPropagation(); toggleFav(fav.dataset.id); return; }

      var sel = e.target.closest && e.target.closest('[data-track-select]');
      if (sel) {
        var p = byId(sel.getAttribute('data-track-select'));
        if (p) track('select_property', propParams(p, { list_name: document.body.dataset.listName || 'listado' }));
      }
      var wa = e.target.closest && e.target.closest('[data-wa]');
      if (wa) {
        var pw = byId(wa.getAttribute('data-wa'));
        track('click_whatsapp', propParams(pw, { source: pw ? 'property_card' : 'global' }));
      }
      var waG = e.target.closest && e.target.closest('[data-wa-global]');
      if (waG) track('click_whatsapp', { source: waG.getAttribute('data-wa-global'), city: 'Ciudad de México' });
    });

    on(document, 'change', function (e) {
      var c = e.target.closest && e.target.closest('.pcard-cmp input');
      if (c) { toggleCmp(c.dataset.id); }
    });
  }

  // ================================================== BUSCADOR + AUTOCOMPLETE
  function acSource() {
    var out = [];
    (D.colonias || []).forEach(function (c) {
      out.push({ t: c.nombre + ', ' + c.alcaldia, k: 'colonia', v: c.slug, sub: 'Colonia', extra: (c.cp || []).join(' ') });
    });
    (D.alcaldias || []).forEach(function (a) {
      out.push({ t: a.nombre, k: 'alcaldia', v: a.slug, sub: 'Alcaldía', extra: '' });
    });
    (D.calles || []).forEach(function (s) {
      out.push({ t: s.calle + ' — ' + s.colonia, k: 'calle', v: s.calle, sub: 'Calle', extra: '' });
    });
    (D.desarrollos || []).forEach(function (s) {
      out.push({ t: s.nombre, k: 'desarrollo', v: s.id, sub: 'Desarrollo', extra: '' });
    });
    ['Zona Poniente', 'Zona Centro', 'Zona Sur', 'Zona Norte'].forEach(function (z) {
      out.push({ t: z + ', CDMX', k: 'zona', v: fold(z).replace(/\s+/g, '-'), sub: 'Zona', extra: '' });
    });
    return out;
  }

  function initAutocomplete(input, panel, hidden) {
    if (!input || !panel) return;
    var src = acSource(), items = [], active = -1;

    function close() { panel.classList.remove('is-open'); input.setAttribute('aria-expanded', 'false'); active = -1; }
    function open() { panel.classList.add('is-open'); input.setAttribute('aria-expanded', 'true'); }

    function render(q) {
      var fq = fold(q);
      items = src.filter(function (i) {
        return fold(i.t).indexOf(fq) > -1 || (i.extra && i.extra.indexOf(q) > -1);
      }).slice(0, 9);
      if (!items.length) { close(); return; }
      var byGroup = {}, order = [];
      items.forEach(function (i) { if (!byGroup[i.sub]) { byGroup[i.sub] = []; order.push(i.sub); } byGroup[i.sub].push(i); });
      var html = '', idx = 0;
      order.forEach(function (g) {
        html += '<div class="ac-group">' + esc(g) + '</div>';
        byGroup[g].forEach(function (i) {
          html += '<button type="button" class="ac-item" role="option" data-i="' + idx + '" data-k="' + i.k + '" data-v="' + esc(i.v) + '">' +
            ICON.pin + '<span>' + esc(i.t) + '</span></button>';
          idx++;
        });
      });
      panel.innerHTML = html; open();
    }

    on(input, 'input', debounce(function () {
      if (hidden) { hidden.value = ''; }
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      render(q);
    }, 130));

    on(input, 'keydown', function (e) {
      var btns = $$('.ac-item', panel);
      if (!panel.classList.contains('is-open') || !btns.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = e.key === 'ArrowDown' ? Math.min(active + 1, btns.length - 1) : Math.max(active - 1, 0);
        btns.forEach(function (b, i) { b.classList.toggle('is-active', i === active); });
        btns[active].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && active > -1) {
        e.preventDefault(); btns[active].click();
      } else if (e.key === 'Escape') { close(); }
    });

    on(panel, 'click', function (e) {
      var b = e.target.closest('.ac-item'); if (!b) return;
      input.value = b.querySelector('span').textContent;
      if (hidden) hidden.value = b.dataset.k + ':' + b.dataset.v;
      close();
    });

    on(document, 'click', function (e) {
      if (!panel.contains(e.target) && e.target !== input) close();
    });
  }

  function initSearchForms() {
    $$('[data-search-form]').forEach(function (form) {
      var input = $('[data-ac-input]', form);
      var panel = $('[data-ac-panel]', form);
      var hidden = $('[data-ac-value]', form);
      initAutocomplete(input, panel, hidden);

      $$('.search-tab', form).forEach(function (tab) {
        on(tab, 'click', function () {
          $$('.search-tab', form).forEach(function (t) { t.setAttribute('aria-selected', 'false'); });
          tab.setAttribute('aria-selected', 'true');
          var op = $('[name="operacion"]', form); if (op) op.value = tab.dataset.op;
        });
      });

      on(form, 'submit', function (e) {
        e.preventDefault();
        var fd = new FormData(form), q = new URLSearchParams();
        var loc = (hidden && hidden.value) || '';
        if (loc) {
          var parts = loc.split(':');
          if (parts[0] === 'colonia') q.set('colonia', parts[1]);
          else if (parts[0] === 'alcaldia') q.set('alcaldia', parts[1]);
          else q.set('q', input.value.trim());
        } else if (input && input.value.trim()) {
          q.set('q', input.value.trim());
        }
        ['operacion', 'tipo', 'precioMin', 'precioMax', 'rec'].forEach(function (k) {
          var v = fd.get(k); if (v) q.set(k, v);
        });
        track('search_property', {
          search_term: input ? input.value.trim() : '',
          operation: fd.get('operacion') || 'venta',
          property_type: fd.get('tipo') || 'todos',
          price_min: Number(fd.get('precioMin')) || 0,
          price_max: Number(fd.get('precioMax')) || 0,
          bedrooms_min: Number(fd.get('rec')) || 0,
          city: 'Ciudad de México'
        });
        save(LS.filtros, q.toString());
        location.href = url('propiedades/') + (q.toString() ? '?' + q.toString() : '');
      });
    });
  }

  // ============================================================ RESULTADOS
  var RES = {
    filtros: {},
    orden: 'recomendadas',
    view: 'split',
    lista: []
  };

  function readQuery() {
    var q = new URLSearchParams(location.search), f = {};
    ['operacion', 'colonia', 'alcaldia', 'tipo', 'q', 'estado', 'antiguedad'].forEach(function (k) {
      if (q.get(k)) f[k] = q.get(k);
    });
    ['precioMin', 'precioMax', 'rec', 'ban', 'est', 'm2Min', 'm2Max'].forEach(function (k) {
      if (q.get(k)) f[k] = Number(q.get(k));
    });
    if (q.get('amenidades')) f.amenidades = q.get('amenidades').split(',').filter(Boolean);
    if (q.get('badges')) f.badges = q.get('badges').split(',').filter(Boolean);
    if (q.get('orden')) RES.orden = q.get('orden');
    if (q.get('view')) RES.view = q.get('view');
    return f;
  }

  function writeQuery(replace) {
    var q = new URLSearchParams(), f = RES.filtros;
    Object.keys(f).forEach(function (k) {
      var v = f[k];
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return;
      q.set(k, Array.isArray(v) ? v.join(',') : v);
    });
    if (RES.orden !== 'recomendadas') q.set('orden', RES.orden);
    if (RES.view !== 'split') q.set('view', RES.view);
    var s = q.toString();
    history[replace ? 'replaceState' : 'pushState']({}, '', location.pathname + (s ? '?' + s : ''));
  }

  function matches(p, f) {
    if (f.operacion && p.operacion !== f.operacion) return false;
    if (f.colonia && p.colonia !== f.colonia) return false;
    if (f.alcaldia && p.alcaldia !== f.alcaldia) return false;
    if (f.tipo && p.tipo !== f.tipo) return false;
    if (f.precioMin && p.precio < f.precioMin) return false;
    if (f.precioMax && p.precio > f.precioMax) return false;
    if (f.rec && p.rec < f.rec) return false;
    if (f.ban && p.ban < f.ban) return false;
    if (f.est && p.est < f.est) return false;
    var m = p.m2c || p.m2t || 0;
    if (f.m2Min && m < f.m2Min) return false;
    if (f.m2Max && m > f.m2Max) return false;
    if (f.estado && p.estado_inm !== f.estado) return false;
    if (f.antiguedad) {
      if (f.antiguedad === 'nueva' && p.antig > 1) return false;
      if (f.antiguedad === '0-5' && p.antig > 5) return false;
      if (f.antiguedad === '5-15' && (p.antig < 5 || p.antig > 15)) return false;
      if (f.antiguedad === '15+' && p.antig < 15) return false;
    }
    if (f.amenidades && f.amenidades.length) {
      for (var i = 0; i < f.amenidades.length; i++) {
        if ((p.amenidades || []).indexOf(f.amenidades[i]) < 0) return false;
      }
    }
    if (f.badges && f.badges.length) {
      for (var j = 0; j < f.badges.length; j++) {
        var b = f.badges[j];
        if (b === 'exclusiva' && !p.exclusiva) return false;
        if (b !== 'exclusiva' && (p.badges || []).indexOf(b) < 0) return false;
      }
    }
    if (f.q) {
      var fq = fold(f.q);
      var hay = fold([p.titulo, p.colonia_nombre, p.alcaldia_nombre, p.calle, p.cp, p.tipo_label, p.id].join(' '));
      if (hay.indexOf(fq) < 0) return false;
    }
    return true;
  }

  function sortList(list, orden) {
    var l = list.slice();
    switch (orden) {
      case 'recientes': l.sort(function (a, b) { return (b.publicado || '').localeCompare(a.publicado || ''); }); break;
      case 'precio-asc': l.sort(function (a, b) { return a.precio - b.precio; }); break;
      case 'precio-desc': l.sort(function (a, b) { return b.precio - a.precio; }); break;
      case 'superficie': l.sort(function (a, b) { return (b.m2c || b.m2t) - (a.m2c || a.m2t); }); break;
      case 'm2': l.sort(function (a, b) { return precioM2(a) - precioM2(b); }); break;
      default:
        l.sort(function (a, b) {
          var s = (b.destacada ? 2 : 0) + (b.exclusiva ? 1 : 0) - ((a.destacada ? 2 : 0) + (a.exclusiva ? 1 : 0));
          return s !== 0 ? s : (b.publicado || '').localeCompare(a.publicado || '');
        });
    }
    return l;
  }

  function initResults() {
    var root = $('#resultados'); if (!root) return;
    RES.filtros = readQuery();
    document.body.dataset.listName = 'resultados_busqueda';

    var listEl = $('#resList'), countEl = $('#resCount'), activeEl = $('#activeFilters');

    function apply(pushState) {
      var list = (D.propiedades || []).filter(function (p) { return matches(p, RES.filtros); });
      list = sortList(list, RES.orden);
      RES.lista = list;

      countEl.innerHTML = '<b>' + list.length + '</b> ' + (list.length === 1 ? 'propiedad encontrada' : 'propiedades encontradas') +
        ' <span class="muted small">en Ciudad de México</span>';

      if (!list.length) {
        listEl.innerHTML = '<div class="empty">' + ICON.search +
          '<h3>No encontramos propiedades con estos filtros</h3>' +
          '<p>Prueba ampliar el rango de precio o quitar alguna característica. Si buscas algo muy específico, Gio puede rastrearlo por ti.</p>' +
          '<div class="cta-actions"><button type="button" class="btn btn--ghost" id="clearAll2">Limpiar filtros</button>' +
          '<a class="btn" href="' + waLink(null) + '" target="_blank" rel="noopener" data-wa-global="empty_results">Pedir ayuda a Gio</a></div></div>';
        on($('#clearAll2'), 'click', clearAll);
      } else {
        listEl.innerHTML = '<div class="card-grid">' + list.map(function (p) { return cardHTML(p); }).join('') + '</div>';
      }

      renderActive();
      syncFavUI(); syncCmpUI();
      updateFilterCounts();
      drawMap(list);
      writeQuery(!pushState);

      track('view_property_list', {
        list_name: 'resultados_busqueda',
        results_count: list.length,
        filters: JSON.stringify(RES.filtros),
        sort: RES.orden,
        city: 'Ciudad de México'
      });
    }
    RES.apply = apply;

    function renderActive() {
      if (!activeEl) return;
      var chips = [];
      var f = RES.filtros;
      function chip(label, key, val) {
        chips.push('<span class="chip">' + esc(label) +
          '<button type="button" aria-label="Quitar filtro ' + esc(label) + '" data-rm="' + key + '" data-val="' + esc(val || '') + '">' + ICON.close + '</button></span>');
      }
      if (f.operacion) chip(f.operacion === 'venta' ? 'En venta' : 'En renta', 'operacion');
      if (f.colonia) chip(nameOf('colonias', f.colonia), 'colonia');
      if (f.alcaldia) chip(nameOf('alcaldias', f.alcaldia), 'alcaldia');
      if (f.tipo) chip(D.tipos_label[f.tipo] || f.tipo, 'tipo');
      if (f.q) chip('“' + f.q + '”', 'q');
      if (f.precioMin) chip('Desde ' + moneyShort(f.precioMin), 'precioMin');
      if (f.precioMax) chip('Hasta ' + moneyShort(f.precioMax), 'precioMax');
      if (f.rec) chip(f.rec + '+ recámaras', 'rec');
      if (f.ban) chip(f.ban + '+ baños', 'ban');
      if (f.est) chip(f.est + '+ estacionamientos', 'est');
      if (f.m2Min) chip('Desde ' + f.m2Min + ' m²', 'm2Min');
      if (f.m2Max) chip('Hasta ' + f.m2Max + ' m²', 'm2Max');
      if (f.estado) chip(D.estados_label[f.estado] || f.estado, 'estado');
      if (f.antiguedad) chip(ANTIG_LABEL[f.antiguedad] || f.antiguedad, 'antiguedad');
      (f.amenidades || []).forEach(function (a) { chip(D.amenidades_label[a] || a, 'amenidades', a); });
      (f.badges || []).forEach(function (b) { chip(BADGE_LABEL[b] || b, 'badges', b); });

      activeEl.innerHTML = chips.length
        ? chips.join('') + '<button type="button" class="chip chip--gold" id="clearAll">Limpiar todo</button>'
        : '';
      on($('#clearAll'), 'click', clearAll);
      $$('[data-rm]', activeEl).forEach(function (b) {
        on(b, 'click', function () {
          var k = b.dataset.rm, v = b.dataset.val;
          if (Array.isArray(RES.filtros[k])) {
            RES.filtros[k] = RES.filtros[k].filter(function (x) { return x !== v; });
            if (!RES.filtros[k].length) delete RES.filtros[k];
          } else delete RES.filtros[k];
          syncControls(); apply(true);
          track('filter_property', { filter_removed: k, filters: JSON.stringify(RES.filtros) });
        });
      });
    }

    function clearAll() {
      RES.filtros = {}; RES.orden = 'recomendadas';
      syncControls(); apply(true);
      track('filter_property', { action: 'clear_all' });
      toast('Filtros limpiados');
    }
    window.gfClearFilters = clearAll;

    // ---- controles de filtros (sidebar + drawer comparten data-attrs)
    function syncControls() {
      var f = RES.filtros;
      $$('[data-f-seg]').forEach(function (g) {
        var key = g.dataset.fSeg;
        $$('button', g).forEach(function (b) {
          b.setAttribute('aria-pressed', String((f[key] || '') === b.dataset.v));
        });
      });
      $$('[data-f-pill]').forEach(function (g) {
        var key = g.dataset.fPill;
        $$('button', g).forEach(function (b) {
          var v = b.dataset.v === '' ? '' : (isNaN(Number(b.dataset.v)) ? b.dataset.v : Number(b.dataset.v));
          b.setAttribute('aria-pressed', String((f[key] == null ? '' : f[key]) === v));
        });
      });
      $$('[data-f-input]').forEach(function (inp) {
        var k = inp.dataset.fInput; inp.value = f[k] == null ? '' : f[k];
      });
      $$('[data-f-select]').forEach(function (s) {
        var k = s.dataset.fSelect; s.value = f[k] == null ? '' : f[k];
      });
      $$('[data-f-check]').forEach(function (c) {
        var k = c.dataset.fCheck, v = c.dataset.v;
        c.checked = (f[k] || []).indexOf(v) > -1;
      });
      $$('[data-sort]').forEach(function (s) { s.value = RES.orden; });
      $$('.view-switch button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === RES.view)); });
      var lay = $('.results-layout'); if (lay) lay.dataset.view = RES.view;
    }

    function updateFilterCounts() {
      $$('[data-f-check]').forEach(function (c) {
        var k = c.dataset.fCheck, v = c.dataset.v;
        var probe = Object.assign({}, RES.filtros);
        probe[k] = (probe[k] || []).concat([v]);
        var n = (D.propiedades || []).filter(function (p) { return matches(p, probe); }).length;
        var lab = c.parentElement.querySelector('.cnt');
        if (lab) lab.textContent = n;
        c.parentElement.style.opacity = (n === 0 && !c.checked) ? '.45' : '1';
      });
    }

    $$('[data-f-seg]').forEach(function (g) {
      var key = g.dataset.fSeg;
      $$('button', g).forEach(function (b) {
        on(b, 'click', function () {
          var v = b.dataset.v;
          if (RES.filtros[key] === v || v === '') delete RES.filtros[key]; else RES.filtros[key] = v;
          syncControls(); apply(true);
          track('filter_property', { filter_name: key, filter_value: v });
        });
      });
    });
    $$('[data-f-pill]').forEach(function (g) {
      var key = g.dataset.fPill;
      $$('button', g).forEach(function (b) {
        on(b, 'click', function () {
          var raw = b.dataset.v;
          var v = raw === '' ? '' : (isNaN(Number(raw)) ? raw : Number(raw));
          if (v === '' || RES.filtros[key] === v) delete RES.filtros[key]; else RES.filtros[key] = v;
          syncControls(); apply(true);
          track('filter_property', { filter_name: key, filter_value: raw });
        });
      });
    });
    $$('[data-f-input]').forEach(function (inp) {
      on(inp, 'change', function () {
        var k = inp.dataset.fInput, v = Number(inp.value);
        if (!inp.value || isNaN(v) || v <= 0) delete RES.filtros[k]; else RES.filtros[k] = v;
        apply(true); track('filter_property', { filter_name: k, filter_value: inp.value });
      });
    });
    $$('[data-f-select]').forEach(function (s) {
      on(s, 'change', function () {
        var k = s.dataset.fSelect;
        if (!s.value) delete RES.filtros[k]; else RES.filtros[k] = s.value;
        apply(true); track('filter_property', { filter_name: k, filter_value: s.value });
      });
    });
    $$('[data-f-check]').forEach(function (c) {
      on(c, 'change', function () {
        var k = c.dataset.fCheck, v = c.dataset.v;
        var arr = RES.filtros[k] || [];
        if (c.checked) { if (arr.indexOf(v) < 0) arr.push(v); }
        else arr = arr.filter(function (x) { return x !== v; });
        if (arr.length) RES.filtros[k] = arr; else delete RES.filtros[k];
        // reflejar en el panel gemelo (sidebar/drawer)
        $$('[data-f-check][data-v="' + v + '"]').forEach(function (o) { o.checked = c.checked; });
        apply(true); track('filter_property', { filter_name: k, filter_value: v, checked: c.checked });
      });
    });
    $$('[data-sort]').forEach(function (s) {
      on(s, 'change', function () {
        RES.orden = s.value; syncControls(); apply(true);
        track('filter_property', { filter_name: 'orden', filter_value: RES.orden });
      });
    });
    $$('.view-switch button').forEach(function (b) {
      on(b, 'click', function () {
        RES.view = b.dataset.view; syncControls(); writeQuery(true);
        setTimeout(function () { drawMap(RES.lista); }, 60);
      });
    });
    $$('[data-open-drawer]').forEach(function (b) {
      on(b, 'click', function () { openDrawer($('#' + b.dataset.openDrawer)); });
    });
    on($('#mobileMapBtn'), 'click', function () {
      RES.view = RES.view === 'mapa' ? 'lista' : 'mapa';
      syncControls(); drawMap(RES.lista);
      this.innerHTML = RES.view === 'mapa' ? 'Ver lista' : 'Ver mapa';
    });

    on(window, 'popstate', function () { RES.filtros = readQuery(); syncControls(); apply(false); });

    syncControls();
    apply(false);
    document.body.classList.add('has-mobile-actions');
  }

  var ANTIG_LABEL = { nueva: 'Nueva', '0-5': '0 a 5 años', '5-15': '5 a 15 años', '15+': 'Más de 15 años' };

  function nameOf(coll, slug) {
    var f = (D[coll] || []).filter(function (x) { return x.slug === slug; })[0];
    return f ? f.nombre : slug;
  }

  // ------------------------------------------------------------- DRAWER
  function openDrawer(dr) {
    if (!dr) return;
    var bd = $('#drawerBackdrop');
    dr.classList.add('is-open'); dr.setAttribute('aria-hidden', 'false');
    if (bd) bd.classList.add('is-open');
    document.body.classList.add('no-scroll');
  }
  function closeDrawer(dr) {
    if (!dr) return;
    var bd = $('#drawerBackdrop');
    dr.classList.remove('is-open'); dr.setAttribute('aria-hidden', 'true');
    if (bd) bd.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
  }
  function initDrawers() {
    $$('[data-close-drawer]').forEach(function (b) {
      on(b, 'click', function () { closeDrawer(b.closest('.drawer')); });
    });
    on($('#drawerBackdrop'), 'click', function () { var d = $('.drawer.is-open'); if (d) closeDrawer(d); });
  }

  // ================================================================ MAPA
  var MAP = { impl: null, gmap: null, markers: [], zoom: 1, center: null };

  function initMap() {
    var host = $('#map'); if (!host) return;
    if (CFG.googleMapsKey) loadGoogle(host);
    else buildFallback(host);
  }

  function loadGoogle(host) {
    if (window.google && window.google.maps) { setupGoogle(host); return; }
    var s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(CFG.googleMapsKey) + '&libraries=marker&loading=async&language=es&region=MX';
    s.async = true; s.defer = true;
    s.onerror = function () { console.warn('[Gio] Google Maps no cargó. Usando mapa de respaldo.'); buildFallback(host); };
    window.gfInitGoogle = function () { setupGoogle(host); };
    s.src += '&callback=gfInitGoogle';
    document.head.appendChild(s);
  }

  function setupGoogle(host) {
    MAP.impl = 'google';
    var canvas = $('.map-canvas', host) || host;
    MAP.gmap = new google.maps.Map(canvas, {
      center: { lat: 19.404, lng: -99.175 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: GMAP_STYLE
    });
    MAP.gmap.addListener('idle', function () {
      var b = $('#mapSearchArea'); if (b) b.style.display = 'inline-flex';
    });
    drawMap(RES.lista.length ? RES.lista : (D.propiedades || []));
  }

  var GMAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#f4f5f8' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6b7ea3' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dfe9dc' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f0e9dc' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d7e2ee' }] }
  ];

  // ---- Mapa de respaldo (sin API key): proyección lineal sobre CDMX
  var BOUNDS = { n: 19.50, s: 19.28, w: -99.31, e: -99.03 };

  function fitBounds(list) {
    if (!list || list.length < 2) return;
    var lats = list.map(function (p) { return p.lat; }), lngs = list.map(function (p) { return p.lng; });
    var n = Math.max.apply(null, lats), s = Math.min.apply(null, lats);
    var e2 = Math.max.apply(null, lngs), w = Math.min.apply(null, lngs);
    var padY = Math.max((n - s) * 0.22, 0.012), padX = Math.max((e2 - w) * 0.16, 0.014);
    BOUNDS = { n: n + padY, s: s - padY, w: w - padX, e: e2 + padX };
  }

  function buildFallback(host) {
    MAP.impl = 'fallback';
    var canvas = $('.map-canvas', host) || host;
    canvas.innerHTML =
      '<div class="map-fallback" aria-hidden="true">' +
        roads() + greens() + labels() +
      '</div>' +
      '<div class="map-note">Vista esquemática · agrega tu llave de Google Maps en <code>assets/js/config.js</code> para el mapa real</div>';
    var mp = document.createElement('div'); mp.className = 'map-preview'; mp.id = 'mapPreview';
    canvas.appendChild(mp);
    var mc = document.createElement('div'); mc.className = 'map-minicard'; mc.id = 'mapMiniCard';
    canvas.appendChild(mc);
    drawMap(RES.lista.length ? RES.lista : (D.propiedades || []));

    function roads() {
      var h = '';
      // ejes viales principales aproximados de la CDMX central
      [[0, 26, 100, 1.6], [0, 47, 100, 2.2], [0, 68, 100, 1.6], [0, 86, 100, 1.4]].forEach(function (r) {
        h += '<i class="mf-road" style="left:' + r[0] + '%;top:' + r[1] + '%;width:' + r[2] + '%;height:' + r[3] + 'px"></i>';
      });
      [[22, 0, 100, 1.6], [41, 0, 100, 2.2], [58, 0, 100, 1.6], [78, 0, 100, 1.4]].forEach(function (r) {
        h += '<i class="mf-road" style="left:' + r[0] + '%;top:' + r[1] + '%;height:' + r[2] + '%;width:' + r[3] + 'px"></i>';
      });
      h += '<i class="mf-road mf-road--main" style="left:10%;top:12%;width:82%;height:3px;transform:rotate(19deg);transform-origin:left"></i>';
      return h;
    }
    function greens() {
      return '<i class="mf-green" style="left:24%;top:30%;width:15%;height:22%"></i>' +
             '<i class="mf-green" style="left:47%;top:62%;width:9%;height:11%"></i>' +
             '<i class="mf-green" style="left:12%;top:70%;width:11%;height:13%"></i>' +
             '<i class="mf-green" style="left:69%;top:20%;width:8%;height:9%"></i>';
    }
    function labels() {
      return '<span class="mf-label" style="left:26%;top:26%">Chapultepec</span>' +
             '<span class="mf-label" style="left:44%;top:44%">Roma · Condesa</span>' +
             '<span class="mf-label" style="left:47%;top:66%">Del Valle</span>' +
             '<span class="mf-label" style="left:70%;top:16%">Centro</span>' +
             '<span class="mf-label" style="left:14%;top:74%">Sur poniente</span>';
    }
  }

  function project(lat, lng) {
    var x = (lng - BOUNDS.w) / (BOUNDS.e - BOUNDS.w) * 100;
    var y = (BOUNDS.n - lat) / (BOUNDS.n - BOUNDS.s) * 100;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(3, Math.min(97, y)) };
  }

  function drawMap(list) {
    list = list || [];
    var host = $('#map'); if (!host) return;
    if (MAP.impl === 'google' && MAP.gmap) return drawGoogle(list);
    if (MAP.impl !== 'fallback') return;
    var canvas = $('.map-canvas', host) || host;
    $$('.map-pin,.map-cluster', canvas).forEach(function (n) { n.remove(); });
    var fav = favs();
    fitBounds(list);

    // agrupar propiedades cercanas entre sí en un mismo cluster para no amontonar precios
    var CX = 11, CY = 9;
    var clusters = [];
    list.forEach(function (p) {
      var pt = project(p.lat, p.lng);
      var c = clusters.filter(function (c) {
        return Math.abs(c.x - pt.x) < CX && Math.abs(c.y - pt.y) < CY;
      })[0];
      if (c) {
        c.items.push(p);
        c.x = (c.x * (c.items.length - 1) + pt.x) / c.items.length;
        c.y = (c.y * (c.items.length - 1) + pt.y) / c.items.length;
      } else {
        clusters.push({ x: pt.x, y: pt.y, items: [p] });
      }
    });

    // separar clusters/pines que aun queden demasiado próximos entre sí
    var placed = [];
    clusters.sort(function (a, b) { return b.y - a.y; }).forEach(function (c) {
      var tries = 0;
      while (placed.some(function (o) { return Math.abs(o.x - c.x) < CX && Math.abs(o.y - c.y) < CY; }) && tries < 10) {
        c.y -= 5; c.x += (tries % 2 === 0 ? 6 : -6);
        c.x = Math.max(5, Math.min(95, c.x)); c.y = Math.max(6, Math.min(94, c.y));
        tries++;
      }
      placed.push(c);

      if (c.items.length === 1) {
        var p = c.items[0];
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'map-pin' + (fav.indexOf(p.id) > -1 ? ' is-fav' : '');
        b.style.left = c.x + '%'; b.style.top = c.y + '%';
        b.textContent = moneyShort(p.precio);
        b.dataset.id = p.id;
        b.setAttribute('aria-label', p.titulo + ' — ' + money(p.precio));
        on(b, 'mouseenter', function () { showPreview(p, c); b.classList.add('is-active'); });
        on(b, 'mouseleave', function () { hidePreview(); b.classList.remove('is-active'); });
        on(b, 'focus', function () { showPreview(p, c); });
        on(b, 'blur', hidePreview);
        on(b, 'click', function () { showMini(p); });
        canvas.appendChild(b);
      } else {
        var items = c.items;
        var cb = document.createElement('button');
        cb.type = 'button';
        cb.className = 'map-cluster';
        cb.style.left = c.x + '%'; cb.style.top = c.y + '%';
        cb.textContent = items.length;
        cb.setAttribute('aria-label', items.length + ' propiedades en esta zona');
        on(cb, 'click', function () { showClusterList(items); });
        canvas.appendChild(cb);
      }
    });

    var note = $('.map-note', canvas);
    if (note) note.innerHTML = list.length + ' propiedades en el mapa · vista esquemática. Agrega tu llave de Google Maps en <code>assets/js/config.js</code>.';
  }

  function showClusterList(items) {
    var mc = $('#mapMiniCard'); if (!mc) return;
    var rows = items.slice(0, 8).map(function (p) {
      return '<a class="mcl-row" href="' + url(p.url) + '">' +
        '<span class="mcl-price">' + moneyShort(p.precio) + '</span>' +
        '<span class="mcl-t">' + esc(p.titulo) + '</span></a>';
    }).join('');
    var more = items.length > 8
      ? '<p class="small muted" style="padding:.5rem 1rem 0">+' + (items.length - 8) + ' propiedades más en esta zona</p>'
      : '';
    mc.innerHTML = '<button type="button" class="mc-close" aria-label="Cerrar">' + ICON.close + '</button>' +
      '<div class="mcl-head">' + items.length + ' propiedades en esta zona</div>' +
      '<div class="mcl-list">' + rows + '</div>' + more;
    mc.classList.add('is-on');
    on($('.mc-close', mc), 'click', function () { mc.classList.remove('is-on'); });
  }

  function showPreview(p, pt) {
    var mp = $('#mapPreview'); if (!mp) return;
    mp.innerHTML = '<img src="' + url(p.foto_card) + '" alt=""><div class="mp-body">' +
      '<div class="mp-price">' + money(p.precio) + (p.operacion === 'renta' ? ' <span style="font-size:.7em">/mes</span>' : '') + '</div>' +
      '<div class="mp-t">' + esc(p.titulo) + '</div></div>';
    mp.style.left = pt.x + '%'; mp.style.top = pt.y + '%';
    mp.classList.add('is-on');
  }
  function hidePreview() { var mp = $('#mapPreview'); if (mp) mp.classList.remove('is-on'); }

  function showMini(p) {
    var mc = $('#mapMiniCard'); if (!mc) return;
    mc.innerHTML = '<button type="button" class="mc-close" aria-label="Cerrar">' + ICON.close + '</button>' + cardHTML(p, { noCmp: true });
    mc.classList.add('is-on');
    syncFavUI();
    on($('.mc-close', mc), 'click', function () { mc.classList.remove('is-on'); });
    track('select_property', propParams(p, { list_name: 'mapa' }));
  }

  function drawGoogle(list) {
    MAP.markers.forEach(function (m) { m.setMap && m.setMap(null); });
    MAP.markers = [];
    if (!list.length) return;
    var bounds = new google.maps.LatLngBounds();
    var info = new google.maps.InfoWindow();
    list.forEach(function (p) {
      var pos = { lat: p.lat, lng: p.lng };
      bounds.extend(pos);
      var mk = new google.maps.Marker({
        position: pos, map: MAP.gmap, title: p.titulo,
        label: { text: moneyShort(p.precio), fontFamily: 'Jost, sans-serif', fontSize: '12px', fontWeight: '600', color: '#071F4A' },
        icon: {
          path: 'M -34,-13 h 68 a 10,10 0 0 1 10,10 v 6 a 10,10 0 0 1 -10,10 h -68 a 10,10 0 0 1 -10,-10 v -6 a 10,10 0 0 1 10,-10 z',
          fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#071F4A', strokeWeight: 1.5, scale: 1, labelOrigin: new google.maps.Point(0, 0)
        }
      });
      mk.addListener('click', function () {
        info.setContent('<div style="max-width:250px;font-family:Inter,sans-serif">' +
          '<img src="' + url(p.foto_card) + '" alt="" style="width:100%;border-radius:6px;margin-bottom:6px">' +
          '<div style="font-family:Jost,sans-serif;font-size:16px;color:#071F4A">' + money(p.precio) + '</div>' +
          '<div style="font-size:13px;color:#4A5468;line-height:1.35">' + esc(p.titulo) + '</div>' +
          '<a href="' + url(p.url) + '" style="display:inline-block;margin-top:8px;font-size:13px;color:#071F4A;font-weight:600">Ver propiedad →</a></div>');
        info.open(MAP.gmap, mk);
        track('select_property', propParams(p, { list_name: 'mapa' }));
      });
      MAP.markers.push(mk);
    });
    if (list.length > 1) MAP.gmap.fitBounds(bounds, 60);
    else MAP.gmap.setCenter(bounds.getCenter());
  }

  function initMapTools() {
    on($('#mapSearchArea'), 'click', function () {
      if (MAP.impl === 'google' && MAP.gmap) {
        var b = MAP.gmap.getBounds(); if (!b) return;
        var list = (D.propiedades || []).filter(function (p) {
          return matches(p, RES.filtros) && b.contains(new google.maps.LatLng(p.lat, p.lng));
        });
        RES.lista = sortList(list, RES.orden);
        var le = $('#resList'), ce = $('#resCount');
        if (le) le.innerHTML = RES.lista.length
          ? '<div class="card-grid">' + RES.lista.map(function (p) { return cardHTML(p); }).join('') + '</div>'
          : '<div class="empty">' + ICON.search + '<h3>No hay propiedades en esta zona del mapa</h3><p>Desplaza o aleja el mapa para ver más opciones.</p></div>';
        if (ce) ce.innerHTML = '<b>' + RES.lista.length + '</b> propiedades en esta zona <span class="muted small">de Ciudad de México</span>';
        syncFavUI(); syncCmpUI();
      } else {
        toast('Disponible con Google Maps activo');
      }
      track('search_property', { search_type: 'map_area', results_count: RES.lista.length });
    });
    $$('[data-map-zoom]').forEach(function (b) {
      on(b, 'click', function () {
        if (MAP.impl === 'google' && MAP.gmap) MAP.gmap.setZoom(MAP.gmap.getZoom() + Number(b.dataset.mapZoom));
        else toast('Zoom disponible con Google Maps activo');
      });
    });
  }

  // ============================================================ LIGHTBOX
  var LBX = { imgs: [], i: 0 };
  function openLightbox(imgs, start) {
    LBX.imgs = imgs; LBX.i = start || 0;
    var lb = $('#lightbox'); if (!lb) return;
    lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    renderLB();
    var c = $('#lbClose'); if (c) c.focus();
  }
  function closeLightbox() {
    var lb = $('#lightbox'); if (!lb) return;
    lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }
  function renderLB() {
    var st = $('#lbStageImg'), th = $('#lbThumbs'), c = $('#lbCounter');
    if (!st) return;
    st.src = LBX.imgs[LBX.i];
    st.alt = 'Fotografía ' + (LBX.i + 1) + ' de ' + LBX.imgs.length;
    if (c) c.textContent = (LBX.i + 1) + ' / ' + LBX.imgs.length;
    if (th) {
      th.innerHTML = LBX.imgs.map(function (src, i) {
        return '<button type="button" data-i="' + i + '" aria-current="' + (i === LBX.i) + '" aria-label="Ver fotografía ' + (i + 1) + '"><img src="' + src + '" alt=""></button>';
      }).join('');
      var act = $('[aria-current="true"]', th); if (act) act.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }
  function initLightbox() {
    var lb = $('#lightbox'); if (!lb) return;
    on($('#lbClose'), 'click', closeLightbox);
    on($('#lbPrev'), 'click', function () { LBX.i = (LBX.i - 1 + LBX.imgs.length) % LBX.imgs.length; renderLB(); });
    on($('#lbNext'), 'click', function () { LBX.i = (LBX.i + 1) % LBX.imgs.length; renderLB(); });
    on($('#lbThumbs'), 'click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      LBX.i = Number(b.dataset.i); renderLB();
    });
    on(document, 'keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'ArrowLeft') { LBX.i = (LBX.i - 1 + LBX.imgs.length) % LBX.imgs.length; renderLB(); }
      if (e.key === 'ArrowRight') { LBX.i = (LBX.i + 1) % LBX.imgs.length; renderLB(); }
    });
    $$('[data-lightbox]').forEach(function (b) {
      on(b, 'click', function () {
        var imgs = (window.GF_GALLERY || []).map(function (s) { return url(s); });
        openLightbox(imgs, Number(b.dataset.lightbox) || 0);
      });
    });
  }

  // ============================================================ LEADS
  function captureLead(form) {
    var fd = new FormData(form), lead = {};
    fd.forEach(function (v, k) { if (k !== 'consent') lead[k] = v; });
    var q = new URLSearchParams(location.search);
    var pid = form.dataset.propertyId || '';
    var p = pid ? byId(pid) : null;

    Object.assign(lead, {
      fuente: form.dataset.source || 'sitio_web',
      formulario: form.dataset.formName || 'contacto',
      propiedad_id: pid || null,
      propiedad_titulo: p ? p.titulo : null,
      operacion: p ? p.operacion : (lead.operacion || null),
      colonia: p ? p.colonia_nombre : (lead.colonia || null),
      alcaldia: p ? p.alcaldia_nombre : (lead.alcaldia || null),
      ciudad: 'Ciudad de México',
      url: location.href,
      referrer: document.referrer || null,
      utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'),
      utm_campaign: q.get('utm_campaign'), utm_content: q.get('utm_content'), utm_term: q.get('utm_term'),
      gclid: q.get('gclid'), fbclid: q.get('fbclid'),
      fecha: new Date().toISOString()
    });

    var all = store(LS.leads, []);
    all.push(lead); save(LS.leads, all);

    // Punto de integración con CRM (HubSpot u otro). Ver README.
    if (typeof window.gfSendToCRM === 'function') {
      try { window.gfSendToCRM(lead); } catch (e) { console.warn('[Gio] CRM handler falló', e); }
    }
    return lead;
  }
  window.gfLeads = function () { return store(LS.leads, []); };

  function validate(form) {
    var ok = true;
    $$('[required]', form).forEach(function (f) {
      var row = f.closest('.form-row') || f.parentElement;
      var bad = false;
      if (f.type === 'checkbox') bad = !f.checked;
      else if (!f.value.trim()) bad = true;
      else if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(f.value.trim())) bad = true;
      else if (f.type === 'tel' && f.value.replace(/\D/g, '').length < 10) bad = true;
      if (row) row.classList.toggle('is-error', bad);
      if (bad && ok) { f.focus(); }
      if (bad) ok = false;
    });
    return ok;
  }

  // Formularios con lógica propia (valuación y publicar propiedad) se manejan aparte.
  var FORMS_ESPECIALES = ['valForm', 'venderForm'];

  function initForms() {
    $$('[data-lead-form]').forEach(function (form) {
      if (FORMS_ESPECIALES.indexOf(form.id) > -1) return;
      $$('input,select,textarea', form).forEach(function (f) {
        on(f, 'input', function () { var r = f.closest('.form-row'); if (r) r.classList.remove('is-error'); });
      });
      on(form, 'submit', function (e) {
        e.preventDefault();
        if (!validate(form)) { toast('Revisa los campos marcados'); return; }
        var lead = captureLead(form);
        var evt = form.dataset.event || 'generate_lead';
        var p = form.dataset.propertyId ? byId(form.dataset.propertyId) : null;
        track(evt, propParams(p, {
          form_name: form.dataset.formName || 'contacto',
          lead_source: lead.fuente,
          city: 'Ciudad de México'
        }));
        var ok = $('[data-form-success]', form.parentElement) || $('[data-form-success]', form);
        if (ok) {
          form.style.display = 'none';
          ok.classList.add('is-on');
          ok.setAttribute('tabindex', '-1'); ok.focus();
        } else {
          toast('Mensaje enviado. Gio te contacta pronto.');
          form.reset();
        }
      });
    });

    // Agendar visita
    $$('[data-schedule]').forEach(function (b) {
      on(b, 'click', function () {
        var p = byId(b.dataset.schedule);
        track('schedule_visit', propParams(p, { source: 'property_detail' }));
        var f = $('#contactoGio');
        if (f) {
          var msg = $('[name="mensaje"]', f);
          if (msg) msg.value = 'Hola Gio, me gustaría agendar una visita para conocer esta propiedad. Mi disponibilidad es: ';
          f.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(function () { if (msg) { msg.focus(); msg.setSelectionRange(msg.value.length, msg.value.length); } }, 500);
        }
      });
    });
  }

  // ======================================================= FAVORITOS PAGE
  function initFavPage() {
    var host = $('#favList'); if (!host) return;
    function render() {
      var ids = favs();
      var list = ids.map(byId).filter(Boolean);
      var head = $('#favCount');
      if (head) head.innerHTML = '<b>' + list.length + '</b> ' + (list.length === 1 ? 'propiedad guardada' : 'propiedades guardadas');
      if (!list.length) {
        host.innerHTML = '<div class="empty">' + ICON.heart.replace('<svg', '<svg fill="none" stroke="currentColor" stroke-width="1.4"') +
          '<h3>Todavía no has guardado propiedades</h3>' +
          '<p>Toca el corazón en cualquier propiedad para tenerla aquí y compararla después con calma.</p>' +
          '<div class="cta-actions"><a class="btn" href="' + url('propiedades/') + '">Explorar propiedades</a></div></div>';
        return;
      }
      host.innerHTML = '<div class="card-grid">' + list.map(function (p) { return cardHTML(p); }).join('') + '</div>';
      syncFavUI(); syncCmpUI();
    }
    render();
    document.addEventListener('gf:favchange', render);
    var _t = toggleFav;
    toggleFav = function (id) { var r = _t(id); render(); return r; };
    on($('#favClear'), 'click', function () {
      save(LS.fav, []); syncFavUI(); render(); toast('Favoritos vaciados');
    });
    on($('#favCompare'), 'click', function () {
      var ids = favs().slice(0, MAX_CMP);
      if (!ids.length) { toast('Guarda al menos una propiedad'); return; }
      save(LS.cmp, ids); location.href = url('comparador/');
    });
  }

  // ======================================================= COMPARADOR PAGE
  function initCmpPage() {
    var host = $('#cmpRoot'); if (!host) return;
    function render() {
      var list = cmps().map(byId).filter(Boolean);
      if (!list.length) {
        host.innerHTML = '<div class="empty">' + ICON.area +
          '<h3>Selecciona propiedades para comparar</h3>' +
          '<p>Marca la casilla “Comparar” en hasta ' + MAX_CMP + ' propiedades y aquí verás sus diferencias lado a lado.</p>' +
          '<div class="cta-actions"><a class="btn" href="' + url('propiedades/') + '">Ver propiedades</a>' +
          '<a class="btn btn--ghost" href="' + url('favoritos/') + '">Mis favoritos</a></div></div>';
        return;
      }
      var rows = [
        ['Precio', function (p) { return money(p.precio) + (p.operacion === 'renta' ? ' /mes' : ''); }, 'min', function (p) { return p.precio; }],
        ['Operación', function (p) { return p.operacion === 'venta' ? 'Venta' : 'Renta'; }],
        ['Tipo', function (p) { return p.tipo_label; }],
        ['Precio por m²', function (p) { return precioM2(p) ? money(precioM2(p)) : '—'; }, 'min', function (p) { return precioM2(p) || Infinity; }],
        ['Colonia', function (p) { return p.colonia_nombre; }],
        ['Alcaldía', function (p) { return p.alcaldia_nombre; }],
        ['Superficie construida', function (p) { return p.m2c ? num(p.m2c) + ' m²' : '—'; }, 'max', function (p) { return p.m2c || 0; }],
        ['Superficie de terreno', function (p) { return p.m2t ? num(p.m2t) + ' m²' : '—'; }, 'max', function (p) { return p.m2t || 0; }],
        ['Recámaras', function (p) { return p.rec || '—'; }, 'max', function (p) { return p.rec || 0; }],
        ['Baños', function (p) { return p.ban ? p.ban + (p.medios ? ' + ' + p.medios + ' medio' + (p.medios > 1 ? 's' : '') : '') : '—'; }, 'max', function (p) { return p.ban || 0; }],
        ['Estacionamientos', function (p) { return p.est || '—'; }, 'max', function (p) { return p.est || 0; }],
        ['Antigüedad', function (p) { return p.antig === 0 ? 'Nueva' : p.antig + ' años'; }, 'min', function (p) { return p.antig; }],
        ['Mantenimiento', function (p) { return p.mantenimiento ? money(p.mantenimiento) + ' /mes' : 'Sin cuota'; }, 'min', function (p) { return p.mantenimiento || 0; }],
        ['Estado', function (p) { return D.estados_label[p.estado_inm] || p.estado_inm; }],
        ['Amenidades', function (p) { return (p.amenidades || []).map(function (a) { return D.amenidades_label[a] || a; }).join(' · ') || '—'; }]
      ];
      var html = '<div style="overflow-x:auto"><table class="cmp-table"><caption class="sr-only">Comparación de propiedades seleccionadas</caption><thead><tr><th scope="col"><span class="sr-only">Característica</span></th>';
      list.forEach(function (p) {
        html += '<th scope="col"><div class="cmp-head-card">' +
          '<a href="' + url(p.url) + '"><img src="' + url(p.foto_card) + '" alt="' + esc(p.titulo) + '"></a>' +
          '<div class="ch-price">' + money(p.precio) + '</div>' +
          '<div class="ch-t">' + esc(p.titulo) + '</div>' +
          '<button type="button" class="cmp-remove" data-rm="' + esc(p.id) + '">Quitar</button>' +
          '</div></th>';
      });
      html += '</tr></thead><tbody>';
      rows.forEach(function (r) {
        var best = null;
        if (r[2] && list.length > 1) {
          var vals = list.map(r[3]);
          best = r[2] === 'min' ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
        }
        html += '<tr><th scope="row">' + esc(r[0]) + '</th>';
        list.forEach(function (p) {
          var isBest = best !== null && r[3](p) === best && list.length > 1;
          html += '<td' + (isBest ? ' class="best"' : '') + '>' + r[1](p) + '</td>';
        });
        html += '</tr>';
      });
      html += '<tr><th scope="row">Acciones</th>';
      list.forEach(function (p) {
        html += '<td><a class="btn btn--sm" href="' + url(p.url) + '">Ver ficha</a> ' +
          '<a class="btn btn--sm btn--ghost" href="' + waLink(p) + '" target="_blank" rel="noopener" data-wa="' + esc(p.id) + '">WhatsApp</a></td>';
      });
      html += '</tr></tbody></table></div>' +
        '<div class="cta-actions" style="justify-content:flex-start;margin-top:1.5rem">' +
        '<button type="button" class="btn btn--ghost" id="cmpClear">Vaciar comparador</button>' +
        '<a class="btn" href="' + waLink(null) + '" target="_blank" rel="noopener" data-wa-global="comparador">Pedirle a Gio que las compare conmigo</a></div>';
      host.innerHTML = html;
      $$('[data-rm]', host).forEach(function (b) {
        on(b, 'click', function () { toggleCmp(b.dataset.rm); render(); });
      });
      on($('#cmpClear'), 'click', function () { save(LS.cmp, []); syncCmpUI(); render(); toast('Comparador vaciado'); });
      track('compare_property', { action: 'view', compare_count: list.length });
    }
    render();
  }

  // ========================================================= VALUACIÓN
  function liveClear(form) {
    $$('input,select,textarea', form).forEach(function (f) {
      on(f, 'input', function () { var r = f.closest('.form-row'); if (r) r.classList.remove('is-error'); });
      on(f, 'change', function () { var r = f.closest('.form-row'); if (r) r.classList.remove('is-error'); });
    });
  }

  function initValuacion() {
    var form = $('#valForm'); if (!form) return;
    liveClear(form);
    on(form, 'submit', function (e) {
      e.preventDefault();
      if (!validate(form)) { toast('Revisa los campos marcados'); return; }
      var fd = new FormData(form);
      var colSlug = fd.get('colonia');
      var col = (D.colonias || []).filter(function (c) { return c.slug === colSlug; })[0];
      var base = col ? col.precio_m2_venta : 55000;
      var m2 = Number(fd.get('m2')) || 80;
      var tipo = fd.get('tipo');
      var antig = Number(fd.get('antiguedad')) || 0;
      var rec = Number(fd.get('recamaras')) || 2;
      var est = Number(fd.get('estacionamientos')) || 0;

      var factor = 1;
      if (tipo === 'casa' || tipo === 'casa-en-condominio') factor *= 0.92;
      if (tipo === 'penthouse') factor *= 1.18;
      if (tipo === 'loft') factor *= 0.96;
      if (antig <= 2) factor *= 1.08;
      else if (antig <= 10) factor *= 1.0;
      else if (antig <= 25) factor *= 0.93;
      else factor *= 0.86;
      if (est >= 2) factor *= 1.04;
      if (rec >= 3) factor *= 1.02;

      var central = Math.round(base * m2 * factor);
      var lo = Math.round(central * 0.92 / 10000) * 10000;
      var hi = Math.round(central * 1.09 / 10000) * 10000;

      captureLead(form);
      track('request_valuation', {
        form_name: 'valuacion',
        colonia: col ? col.nombre : colSlug,
        alcaldia: col ? col.alcaldia : '',
        property_type: tipo, m2: m2,
        estimated_low: lo, estimated_high: hi, city: 'Ciudad de México'
      });

      var res = $('#valResult');
      $('#valLow').textContent = money(lo);
      $('#valHigh').textContent = money(hi);
      $('#valCentral').textContent = money(central);
      $('#valM2').textContent = money(Math.round(central / m2));
      $('#valZona').textContent = col ? (col.nombre + ', ' + col.alcaldia) : 'Ciudad de México';
      $('#valBase').textContent = money(base);
      form.style.display = 'none';
      res.classList.add('is-on');
      res.setAttribute('tabindex', '-1'); res.focus();
      res.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    // dependencia alcaldía → colonia
    var alc = $('#valAlcaldia'), col = $('#valColonia');
    if (alc && col) {
      var all = col.innerHTML;
      on(alc, 'change', function () {
        var a = alc.value;
        if (!a) { col.innerHTML = all; return; }
        var opts = '<option value="">Selecciona una colonia</option>';
        (D.colonias || []).filter(function (c) { return c.alcaldia_slug === a; }).forEach(function (c) {
          opts += '<option value="' + c.slug + '">' + esc(c.nombre) + '</option>';
        });
        var otras = (D.colonias || []).filter(function (c) { return c.alcaldia_slug === a; }).length;
        if (!otras) opts += '<option value="__otra">Otra colonia de esta alcaldía</option>';
        col.innerHTML = opts;
      });
    }
  }

  // ================================================== VENDER (multi-paso)
  function initVender() {
    var form = $('#venderForm'); if (!form) return;
    liveClear(form);
    var alc = $('#venAlcaldia'), col = $('#venColonia');
    if (alc && col) {
      on(alc, 'change', function () {
        var opts = '<option value="">Selecciona una colonia</option>';
        (D.colonias || []).filter(function (c) { return c.alcaldia_slug === alc.value; }).forEach(function (c) {
          opts += '<option value="' + c.slug + '">' + esc(c.nombre) + '</option>';
        });
        opts += '<option value="__otra">Otra colonia</option>';
        col.innerHTML = opts;
      });
    }
    var fileInp = $('#venFotos'), fileLbl = $('#venFotosLabel');
    if (fileInp && fileLbl) {
      on(fileInp, 'change', function () {
        fileLbl.textContent = fileInp.files.length
          ? fileInp.files.length + ' fotografía' + (fileInp.files.length > 1 ? 's' : '') + ' seleccionada' + (fileInp.files.length > 1 ? 's' : '')
          : 'Agregar fotografías (opcional)';
      });
    }
    on(form, 'submit', function (e) {
      e.preventDefault();
      if (!validate(form)) { toast('Revisa los campos marcados'); return; }
      var fd = new FormData(form);
      captureLead(form);
      track('submit_property', {
        form_name: 'vender_propiedad',
        property_type: fd.get('tipo'),
        colonia: fd.get('colonia'), alcaldia: fd.get('alcaldia'),
        m2: Number(fd.get('m2')) || 0,
        expected_price: Number(fd.get('precio')) || 0,
        city: 'Ciudad de México'
      });
      form.style.display = 'none';
      var ok = $('#venderSuccess'); if (ok) { ok.classList.add('is-on'); ok.setAttribute('tabindex', '-1'); ok.focus(); ok.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  }

  // ================================================== CARRUSELES
  function initCarousels() {
    $$('[data-carousel]').forEach(function (wrap) {
      var track_ = $('.carousel', wrap);
      if (!track_) return;
      $$('[data-car]', wrap).forEach(function (b) {
        on(b, 'click', function () {
          var d = Number(b.dataset.car);
          var step = track_.firstElementChild ? track_.firstElementChild.offsetWidth + 24 : 340;
          track_.scrollBy({ left: d * step, behavior: 'smooth' });
        });
      });
    });
  }

  // ================================================== VISTA DE PROPIEDAD
  function initPropertyView() {
    var pid = document.body.dataset.propertyId;
    if (!pid) return;
    var p = byId(pid); if (!p) return;
    track('view_property', propParams(p, { page_type: 'property_detail' }));
  }

  // =================================================== TABS GENÉRICOS
  function initTabs() {
    $$('[data-tabs]').forEach(function (group) {
      var btns = $$('[role="tab"]', group);
      btns.forEach(function (b) {
        on(b, 'click', function () {
          btns.forEach(function (o) {
            o.setAttribute('aria-selected', String(o === b));
            var panel = document.getElementById(o.getAttribute('aria-controls'));
            if (panel) panel.hidden = (o !== b);
          });
        });
      });
    });
  }

  // ======================================================== ARRANQUE
  function boot() {
    initHeader();
    initDelegation();
    initDrawers();
    initSearchForms();
    initTabs();
    initCarousels();
    initLightbox();
    initForms();
    initResults();
    initMap();
    initMapTools();
    initFavPage();
    initCmpPage();
    initValuacion();
    initVender();
    initPropertyView();
    syncFavUI();
    syncCmpUI();

    // WhatsApp flotante contextual
    $$('[data-wa-fab]').forEach(function (a) {
      var pid = document.body.dataset.propertyId;
      a.href = waLink(pid ? byId(pid) : null);
    });

    // Página vista
    track('page_view_custom', {
      page_type: document.body.dataset.pageType || 'generic',
      page_title: document.title,
      city: 'Ciudad de México'
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
