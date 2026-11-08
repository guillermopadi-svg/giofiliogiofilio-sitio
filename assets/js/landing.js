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

  // -------------------------------------------------------- hero en slide
  // Las fotos rotan solas (6 s), se pueden cambiar con flechas, puntos o
  // deslizando, y el botón secundario cambia según la foto activa.
  (function heroSlider() {
    var media = $('[data-lp-hero]'); if (!media) return;
    var slides = $$('.lp-hero-slide', media), dots = $$('[data-lp-dot]'), cta = $('#lpSlideCta');
    var panelManaged = document.body.matches('[data-landing-id="GF-ESF-P18"]');
    // Do not display withdrawn static photos while awaiting the saved gallery.
    if (panelManaged) media.style.visibility = 'hidden';
    var i = 0, timer = null;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function go(n) {
      if (!slides.length) return;
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
      if (!cta) return;
      var s = slides[i];
      cta.classList.add('is-changing');
      setTimeout(function () {
        cta.textContent = s.dataset.cta || 'Ver galería';
        cta.setAttribute('href', s.dataset.href || '#galeria');
        cta.setAttribute('data-lp', s.dataset.href === '#agendar' ? 'schedule_visit' : 'gallery_jump');
        cta.setAttribute('data-lp-src', 'hero_slide');
        cta.classList.remove('is-changing');
      }, 300);
    }
    function start() { if (reduce || timer || slides.length < 2 || (panelManaged && media.style.visibility === "hidden")) return; timer = setInterval(function () { go(i + 1); }, 6000); }
    function stop() { clearInterval(timer); timer = null; }
    var prev = $('[data-lp-prev]'), next = $('[data-lp-next]');
    if (prev) prev.addEventListener('click', function () { stop(); go(i - 1); });
    if (next) next.addEventListener('click', function () { stop(); go(i + 1); });
    dots.forEach(function (d) { d.addEventListener('click', function () { stop(); go(Number(d.dataset.lpDot)); }); });
    document.addEventListener('gf:landing-photos', function (event) {
      if (!panelManaged || !Array.isArray(event.detail)) return;
      stop();
      var photos = event.detail.slice(0, 4), dotsHost = $('.lp-hero-dots');
      media.replaceChildren();
      if (dotsHost) dotsHost.replaceChildren();
      photos.forEach(function (src, index) {
        var picture = document.createElement('picture'), img = document.createElement('img');
        picture.className = 'lp-hero-slide' + (index === 0 ? ' is-active' : '');
        picture.dataset.cta = 'Ver galería'; picture.dataset.href = '#galeria';
        img.src = src; img.alt = 'Espacio Santa Fe — fotografía ' + (index + 1);
        img.decoding = 'async'; picture.appendChild(img); media.appendChild(picture);
        if (dotsHost) {
          var dot = document.createElement('button'); dot.type = 'button';
          dot.className = 'lp-hero-dot'; dot.dataset.lpDot = index;
          dot.setAttribute('aria-label', 'Ir a la foto ' + (index + 1));
          dot.addEventListener('click', function () { stop(); go(index); });
          dotsHost.appendChild(dot);
        }
      });
      slides = $$('.lp-hero-slide', media); dots = $$('[data-lp-dot]');
      var navigation = $('.lp-hero-nav'); if (navigation) navigation.hidden = slides.length < 2;
      media.style.visibility = 'visible';
      i = 0; go(0); start();
    });
    var hero = media.parentElement, x0 = null;
    hero.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) { stop(); go(i + (dx < 0 ? 1 : -1)); }
    }, { passive: true });
    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    start();
  })();

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

// One visible slide; panel photo changes appear without rebuilding the website.
(function(){
  'use strict';
  var box=document.querySelector('.lp-compact-gallery');if(!box)return;
  var track=box.querySelector('.lp-gallery-track'),prev=box.querySelector('[data-gallery-prev]'),next=box.querySelector('[data-gallery-next]'),counter=box.querySelector('[data-gallery-counter]');
  var sources=(window.GF_GALLERY||[]).map(function(s){return new URL(s,location.origin+'/').href;});
  var labels={};Array.from(track.querySelectorAll('figcaption')).forEach(function(el,i){labels[sources[i]]=el.textContent;});
  function index(){return Math.round(track.scrollLeft/Math.max(1,track.clientWidth));}
  function update(){var i=index();counter.textContent=(sources.length?i+1:0)+' / '+sources.length;prev.disabled=i<=0;next.disabled=i>=sources.length-1;}
  function move(step){track.scrollBy({left:step*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  prev.addEventListener('click',function(){move(-1);});next.addEventListener('click',function(){move(1);});track.addEventListener('scroll',update,{passive:true});
  track.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}});
  track.addEventListener('click',function(e){var b=e.target.closest('[data-gallery-image]');if(b&&window.gfOpenLightbox)window.gfOpenLightbox(sources,Number(b.dataset.galleryImage));});
  window.addEventListener('resize',update);update();
  if(!document.body.matches('[data-landing-id="GF-ESF-P18"]'))return;
  fetch('/api/landing-gallery',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error();return r.json();}).then(function(data){
    if(!Array.isArray(data.fotos))return;
    document.dispatchEvent(new CustomEvent("gf:landing-photos",{detail:data.fotos}));
    if(JSON.stringify(data.fotos)===JSON.stringify(sources))return;
    sources=data.fotos;window.GF_GALLERY=sources;track.replaceChildren();
    sources.forEach(function(src,i){
      var figure=document.createElement('figure');figure.className='lp-gallery-item';
      var button=document.createElement('button');button.type='button';button.dataset.galleryImage=i;button.setAttribute('aria-label','Ampliar foto '+(i+1));
      var img=document.createElement('img');img.src=src;img.loading='lazy';img.alt=labels[src]||'Espacio Santa Fe — fotografía '+(i+1);button.appendChild(img);
      var caption=document.createElement('figcaption');caption.textContent=img.alt;figure.append(button,caption);track.appendChild(figure);
    });track.scrollLeft=0;update();
  }).catch(function(){/* Keep the verified static gallery when the service is unavailable. */});
})();
