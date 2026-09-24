/* Gio Filio — comportamiento de las landings de propiedad (property_landing).
   Depende de gio.js (gfTrack, gfOpenLightbox, gfAttribution). Sin librerías. */
(function () {
  'use strict';
  var CTX = window.GF_LANDING || {};
  var CFG = window.GF_CONFIG || {};
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  // Cada evento lleva los datos de la propiedad y la atribución de campaña.
  function track(name, extra) {
    if (!window.gfTrack) return;
    var attr = (window.gfAttribution && window.gfAttribution()) || {};
    window.gfTrack(name, Object.assign({}, CTX, attr, extra || {}));
  }

  // ------------------------------------------------------------ eventos
  track('view_property', { page_type: 'property_landing' });

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-lp-wa],[data-lp],[data-lp-plan],[data-lp-map]');
    if (!t) return;
    if (t.hasAttribute('data-lp-wa')) {
      track('click_whatsapp', { source: 'landing_' + t.getAttribute('data-lp-wa') });
    }
    var lp = t.getAttribute('data-lp');
    if (lp === 'schedule_visit') track('click_schedule_visit', { source: 'landing_' + (t.getAttribute('data-lp-src') || 'page') });
    if (lp === 'gallery_open' || lp === 'gallery_jump') track('view_gallery', { source: lp });
    if (t.hasAttribute('data-lp-map')) track('click_map', { source: t.getAttribute('data-lp-map') });
  });

  // lead_form_start: primera interacción con el formulario
  var form = $('#contactoGio');
  if (form) {
    var started = false;
    form.addEventListener('focusin', function () {
      if (started) return; started = true;
      track('lead_form_start', { form_name: form.dataset.formName });
    });
  }

  // ------------------------------------------------------ plano con zoom
  $$('[data-lp-plan]').forEach(function (b) {
    b.addEventListener('click', function () {
      track('view_floorplan', { source: 'landing_plano' });
      if (!window.gfOpenLightbox) return;
      var lb = $('#lightbox'), img = $('#lbStageImg');
      window.gfOpenLightbox([b.getAttribute('data-lp-plan')], 0);
      if (lb) lb.classList.add('lb--plan');
      if (img) { img.style.transform = ''; img.classList.remove('is-zoomed'); }
    });
  });
  var stage = $('#lbStageImg');
  if (stage) {
    // clic = acercar / alejar el plano en el punto tocado
    stage.addEventListener('click', function (ev) {
      var lb = $('#lightbox');
      if (!lb || !lb.classList.contains('lb--plan')) return;
      if (stage.classList.contains('is-zoomed')) {
        stage.classList.remove('is-zoomed'); stage.style.transformOrigin = ''; return;
      }
      var r = stage.getBoundingClientRect();
      stage.style.transformOrigin = ((ev.clientX - r.left) / r.width * 100) + '% ' + ((ev.clientY - r.top) / r.height * 100) + '%';
      stage.classList.add('is-zoomed');
    });
  }
  // al cerrar el lightbox se limpia el modo plano para que la galería normal funcione
  var lbEl = $('#lightbox');
  if (lbEl && window.MutationObserver) {
    new MutationObserver(function () {
      if (!lbEl.classList.contains('is-open') && lbEl.classList.contains('lb--plan')) {
        lbEl.classList.remove('lb--plan');
        if (stage) { stage.classList.remove('is-zoomed'); stage.style.transformOrigin = ''; }
      }
    }).observe(lbEl, { attributes: true, attributeFilter: ['class'] });
  }

  // --------------------------------------------------------------- mapa
  // Mapa de un solo punto con la misma API key y mapId que usa el buscador.
  // Si no hay key o no carga, queda el enlace a Google Maps del HTML.
  var host = $('#lpMap');
  if (host && CFG.googleMapsKey) {
    var pos = { lat: parseFloat(host.dataset.lat), lng: parseFloat(host.dataset.lng) };
    var loaded = false;
    var load = function () {
      if (loaded) return; loaded = true;
      window.gfInitLandingMap = function () {
        try {
          host.innerHTML = '';
          var map = new google.maps.Map(host, {
            center: pos, zoom: 16, mapTypeControl: false, streetViewControl: false,
            fullscreenControl: false, mapId: 'e3ec18c168b0c646af205dcb'
          });
          var opts = { map: map, position: pos, title: host.dataset.title || '' };
          if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) new google.maps.marker.AdvancedMarkerElement(opts);
          else new google.maps.Marker(opts);
          map.addListener('click', function () { track('click_map', { source: 'landing_mapa' }); });
          map.addListener('dragstart', function () { track('click_map', { source: 'landing_mapa_drag' }); });
        } catch (err) { console.warn('[Gio] mapa de landing no disponible', err); }
      };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(CFG.googleMapsKey) +
        '&libraries=marker&loading=async&language=es&region=MX&callback=gfInitLandingMap';
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    };
    // se carga al acercarse a la sección (no bloquea el primer render)
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { io.disconnect(); load(); }
      }, { rootMargin: '400px' });
      io.observe(host);
    } else { load(); }
  }
})();
