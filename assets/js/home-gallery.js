/* Accessible controls for the home's property gallery. */
(function(){
  var root=document.querySelector('#destacadas'),track=root&&root.querySelector('.card-grid');
  if(!track)return;
  var controls=document.createElement('div');controls.className='property-gallery-controls';
  controls.innerHTML='<span>Explora más propiedades</span><div><button type="button" aria-label="Propiedades anteriores">←</button><button type="button" aria-label="Más propiedades">→</button></div>';
  track.before(controls);
  var buttons=controls.querySelectorAll('button');
  function sync(){buttons[0].disabled=track.scrollLeft<4;buttons[1].disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-4;}
  buttons.forEach(function(b,i){b.addEventListener('click',function(){var card=track.querySelector('.pcard');track.scrollBy({left:(i?1:-1)*(card.getBoundingClientRect().width+20),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});});
  track.addEventListener('scroll',sync,{passive:true});window.addEventListener('resize',sync);sync();
})();
