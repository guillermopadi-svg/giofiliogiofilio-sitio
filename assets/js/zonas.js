(function(){
 'use strict';
 var root=document.getElementById('zonesExplorer');if(!root)return;
 var mode='colonias',page=1,size=6,input=document.getElementById('zonesSearch');
 var groups={colonias:document.getElementById('zonesColonias'),alcaldias:document.getElementById('zonesAlcaldias')};
 var cards={};Object.keys(groups).forEach(function(key){cards[key]=Array.from(groups[key].querySelectorAll('a'));});
 function norm(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
 function render(){
  var q=norm(input.value),matches=cards[mode].filter(function(card){return norm(card.textContent).includes(q);});
  var pages=Math.max(1,Math.ceil(matches.length/size));page=Math.min(page,pages);
  Object.keys(groups).forEach(function(key){groups[key].hidden=key!==mode;cards[key].forEach(function(card){card.hidden=true;});});
  matches.slice((page-1)*size,page*size).forEach(function(card){card.hidden=false;});
  root.querySelectorAll('[data-zone-mode]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.zoneMode===mode));});
  document.getElementById('zonesTitle').textContent=mode==='colonias'?'Colonias para conocer':'Explora por alcaldía';
  document.getElementById('zonesCount').textContent=matches.length ? ((page-1)*size+1)+'–'+Math.min(page*size,matches.length)+' de '+matches.length+' '+(mode==='colonias'?(matches.length===1?'colonia':'colonias'):(matches.length===1?'alcaldía':'alcaldías')) : '0 resultados';
  document.getElementById('zonesEmpty').hidden=!!matches.length;
  root.querySelector('.zones-pagination').hidden=matches.length<=size;
  document.getElementById('zonesPage').textContent=page+' / '+pages;
  document.getElementById('zonesPrev').disabled=page===1;document.getElementById('zonesNext').disabled=page===pages;
 }
 root.querySelector('.zones-controls').hidden=false;root.classList.add('is-interactive');
 root.querySelectorAll('[data-zone-mode]').forEach(function(b){b.addEventListener('click',function(){mode=b.dataset.zoneMode;page=1;render();});});
 input.addEventListener('input',function(){page=1;render();});
 document.getElementById('zonesPrev').addEventListener('click',function(){page--;render();});
 document.getElementById('zonesNext').addEventListener('click',function(){page++;render();});
 document.getElementById('zonesClear').addEventListener('click',function(){input.value='';page=1;render();input.focus();});
 render();
})();
