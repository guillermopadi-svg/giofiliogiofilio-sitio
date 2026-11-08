(function () {
  'use strict';
  var root = document.getElementById('home-stories');
  if (!root) return;
  var track = root.querySelector('.stories-track');
  var cards = Array.from(track.children);
  var categories = Array.from(root.querySelectorAll('[data-stories-category]'));
  var arrows = Array.from(root.querySelectorAll('[data-stories-direction]'));
  function move(left) {
    track.scrollTo({left: left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }
  categories.forEach(function (button) {
    button.addEventListener('click', function () {
      var card = cards.find(function (item) { return item.dataset.storyKind === button.dataset.storiesCategory; });
      move(card.offsetLeft - cards[0].offsetLeft);
    });
  });
  arrows.forEach(function (button) {
    button.addEventListener('click', function () {
      var distance = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
      move(track.scrollLeft + Number(button.dataset.storiesDirection) * distance);
    });
  });
  function sync() {
    var index = cards.reduce(function (best, card, i) {
      return Math.abs(card.offsetLeft - cards[0].offsetLeft - track.scrollLeft) < Math.abs(cards[best].offsetLeft - cards[0].offsetLeft - track.scrollLeft) ? i : best;
    }, 0);
    categories.forEach(function (button) {button.setAttribute('aria-pressed', String(button.dataset.storiesCategory === cards[index].dataset.storyKind));});
    arrows[0].disabled = track.scrollLeft < 2;
    arrows[1].disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
  }
  track.addEventListener('scroll', sync, {passive:true});
  window.addEventListener('resize', sync);
  sync();
  var pauseButton = root.querySelector('.stories-autoplay');
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var paused = motion.matches;
  var timer;
  function refreshAutoplay() {
    clearInterval(timer);
    pauseButton.textContent = paused ? 'Reanudar' : 'Pausar';
    pauseButton.setAttribute('aria-label', paused ? 'Reanudar carrusel automático' : 'Pausar carrusel automático');
    pauseButton.setAttribute('aria-pressed', String(paused));
    if (!paused && !document.hidden) {
      timer = setInterval(function () {
        // Leave enough reading time after any manual interaction.
        if (root.matches(':hover') || root.contains(document.activeElement)) return;
        var current = categories.find(function (button) {return button.getAttribute('aria-pressed') === 'true';});
        var kind = current && current.dataset.storiesCategory === 'clientes' ? 'blog' : 'clientes';
        var card = cards.find(function (item) {return item.dataset.storyKind === kind;});
        move(card.offsetLeft - cards[0].offsetLeft);
      }, 10000);
    }
  }
  pauseButton.addEventListener('click', function () {paused = !paused; refreshAutoplay();});
  root.addEventListener('click', function (event) {if (event.target.closest('[data-stories-category], [data-stories-direction]')) refreshAutoplay();});
  document.addEventListener('visibilitychange', refreshAutoplay);
  motion.addEventListener('change', function () {paused = motion.matches; refreshAutoplay();});
  refreshAutoplay();
})();
