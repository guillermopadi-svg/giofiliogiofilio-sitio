(function(){
 'use strict';
 function apply(s){
  if(!s)return;
  ['navy','gold'].forEach(function(k){if(/^#[0-9a-f]{6}$/i.test(s[k]||''))document.documentElement.style.setProperty('--'+k,s[k]);});
  function images(selector,url){if(!url)return;document.querySelectorAll(selector).forEach(function(img){if(img.getAttribute('src')!==url){img.removeAttribute('srcset');img.src=url;}});}
  images('.brand-icon',s.icon);images('.brand-word',s.wordmark);images('.footer-logo img',s.footerLogo);
  if(Array.isArray(s.hero)&&s.hero.length===3)document.querySelectorAll('[data-hero-carousel] picture img').forEach(function(img,i){if(s.hero[i]&&new URL(img.src,location.href).href!==new URL(s.hero[i],location.href).href){img.removeAttribute('srcset');img.src=s.hero[i];img.alt='Ciudad de México — Gio Filio';}});
 }
 var preview=new URLSearchParams(location.search).has('gf_brand_preview')&&window.parent!==window;
 if(preview){
  window.addEventListener('message',function(e){if(e.origin===location.origin&&e.source===window.parent&&e.data&&e.data.type==='gf-brand-preview')apply(e.data.settings);});
  document.addEventListener('click',function(e){if(e.target.closest('a,button')){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('submit',function(e){e.preventDefault();e.stopImmediatePropagation();},true);
  window.parent.postMessage({type:'gf-brand-ready'},location.origin);
 }else fetch('/api/site-settings',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error();return r.json();}).then(function(d){apply(d.published);}).catch(function(){/* Retain the built-in brand if settings are unavailable. */});
})();
