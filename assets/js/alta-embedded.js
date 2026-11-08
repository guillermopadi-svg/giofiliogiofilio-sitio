(function () {
  'use strict';
  if (window.parent === window || new URLSearchParams(location.search).get('integrado') !== 'venta') return;
  document.body.classList.add('alta-embedded');
  var form = document.getElementById('altaForm');
  var initialized = false, previous = {};
  form.querySelectorAll('a').forEach(function (link) { link.target = '_blank'; link.rel = 'noopener'; });
  function height() {
    parent.postMessage({type:'gf-sale-height', height:Math.ceil(document.querySelector('.alta-layout').getBoundingClientRect().height) + 24}, location.origin);
  }
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || event.source !== parent || !event.data || event.data.type !== 'gf-sale-prefill') return;
    var data = event.data.data || {};
    var fields = {nombre:'nombre', telefono:'telefono', email:'email', tipo:'tipo', m2:'m2c', recamaras:'rec', banos:'ban', estacionamientos:'est', antiguedad:'antig', alcaldia:'alcaldia'};
    Object.keys(fields).forEach(function (key) {
      var el = form.elements.namedItem(fields[key]);
      if (el && typeof data[key] === 'string') {
        if (!initialized || el.value === previous[key]) { el.value = data[key].slice(0,200); previous[key] = el.value; }
      }
    });
    if (typeof data.colonia === 'string' && data.colonia && (!initialized || form.elements.namedItem('colonia').value === previous.colonia)) {
      var option = new Option(data.colonia, data.colonia, true, true);
      form.elements.namedItem('colonia').add(option); previous.colonia = data.colonia;
    }
    // Keep every field editable, including the prefilled fields; consent is never copied.
    if (!initialized) form.querySelectorAll('.alta-section').forEach(function (section, index) {
      var details = document.createElement('details'); details.className = 'sale-details';
      var summary = document.createElement('summary');
      var heading = section.querySelector('h3'); summary.textContent = heading.textContent.trim(); heading.remove();
      section.parentNode.insertBefore(details, section); details.appendChild(summary); details.appendChild(section);
      details.open = index === 0 && !data.nombre;
    });
    initialized = true;
    height();
  });
  form.addEventListener('submit', function () {
    form.querySelectorAll('details').forEach(function (d) { d.open = true; });
  }, true);
  new ResizeObserver(height).observe(document.querySelector('.alta-layout'));
  parent.postMessage({type:'gf-sale-ready'}, location.origin);
})();
