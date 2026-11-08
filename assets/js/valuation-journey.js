/* A single journey; personal data is passed only to the same-origin form in memory. */
(function () {
  'use strict';
  var form = document.getElementById('valForm');
  var frame = document.getElementById('saleFrame');
  if (!form || !frame) return;
  var estimate = document.getElementById('estimateStep');
  var sale = document.getElementById('saleStep');
  var estimateButton = document.getElementById('journeyEstimate');
  var saleButton = document.getElementById('journeySale');
  var loaded = false, ready = false;
  function showSale() {
    estimate.hidden = true; sale.hidden = false;
    estimateButton.removeAttribute('aria-current'); saleButton.setAttribute('aria-current', 'step');
    if (!loaded) { loaded = true; frame.src = frame.dataset.src; }
    else if (ready) prefill();
    sale.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  function showEstimate() {
    sale.hidden = true; estimate.hidden = false;
    saleButton.removeAttribute('aria-current'); estimateButton.setAttribute('aria-current', 'step');
    estimateButton.focus();
    document.querySelector(".valuation-journey").scrollIntoView({behavior:"smooth", block:"start"});
  }
  function prefill() {
    var data = {};
    ['nombre','telefono','email','tipo','m2','recamaras','banos','estacionamientos','antiguedad'].forEach(function (key) {
      data[key] = form.elements.namedItem(key).value;
    });
    ['colonia','alcaldia'].forEach(function (key) {
      var el = form.elements.namedItem(key);
      data[key] = el.value ? el.options[el.selectedIndex].textContent.split(' — ')[0] : '';
    });
    frame.contentWindow.postMessage({type: 'gf-sale-prefill', data: data}, location.origin);
  }
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || !event.data) return;
    if (event.data.type === 'gf-sale-ready') { ready = true; prefill(); document.getElementById('saleLoading').hidden = true; }
    if (event.data.type === 'gf-sale-height' && Number.isFinite(event.data.height)) {
      frame.style.height = Math.min(16000, Math.max(600, event.data.height)) + 'px';
    }
  });
  document.querySelectorAll('[data-start-sale]').forEach(function (b) { b.addEventListener('click', showSale); });
  saleButton.addEventListener('click', showSale);
  estimateButton.addEventListener('click', showEstimate);
  document.getElementById('editEstimate').addEventListener('click', function () {
    document.getElementById('valResult').classList.remove('is-on');
    form.style.display = ''; form.querySelector('select').focus();
  });
})();
