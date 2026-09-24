/* Gio Filio — Home: tracking de la propiedad destacada y entrada suave.
   Depende de gio.js (gfTrack). Sin librerías. */
(function () {
  'use strict';
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  // Un solo manejador para todo elemento con data-track (hero, sección, tarjetas, barra móvil).
  function payload(el) {
    return {
      property_id: el.getAttribute('data-prop-id') || '',
      property_name: el.getAttribute('data-prop-name') || '',
      property_type: el.getAttribute('data-prop-type') || '',
      property_location: el.getAttribute('data-prop-loc') || '',
      source: el.getAttribute('data-source') || ''
    };
  }
  document.addEventListener('click', function (e) {
    if (!window.gfTrack) return;
    var t = e.target.closest && e.target.closest('[data-track]');
    if (t) {
      window.gfTrack(t.getAttribute('data-track'), Object.assign(payload(t), (window.gfAttribution && window.gfAttribution()) || {}));
      return;
    }
    // Tarjetas de propiedad destacada (2 o más): mismos eventos que la composición editorial
    var card = e.target.closest && e.target.closest('#destacadas .pcard--landing');
    if (!card) return;
    var p = window.gfById && window.gfById(card.getAttribute('data-id'));
    if (!p) return;
    var base = { property_id: p.id, property_name: p.titulo.replace(' — ', ' '), property_type: p.tipo, property_location: 'Santa Fe' };
    var ev = null;
    if (e.target.closest('.pcard-link')) ev = 'click_featured_property';
    else if (e.target.closest('[data-wa]')) ev = 'click_property_whatsapp';
    else if (e.target.closest('.btn--ghost')) ev = 'click_property_cta';
    if (ev) window.gfTrack(ev, Object.assign(base, { source: 'home_featured_card' }));
  });

  // Fade-in al entrar (si no hay IntersectionObserver o se pidió menos movimiento, no se oculta nada)
  var items = $$('[data-reveal]');
  if (items.length && 'IntersectionObserver' in window && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    document.documentElement.classList.add('reveal-ready');
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (n) { io.observe(n); });
  }
})();
