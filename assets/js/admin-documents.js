/* Document browser: derives titles and download URLs from the existing catalog. */
(function () {
  'use strict';
  var root = document.getElementById('docDetail');
  var drawer = document.createElement('aside');
  drawer.className = 'document-inspector';
  drawer.hidden = true;
  drawer.setAttribute('aria-label', 'Detalle del documento');
  root.appendChild(drawer);
  var escape = function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  function select(row) {
    root.querySelectorAll('.doc-row').forEach(function(r){r.classList.toggle('is-selected',r===row);});
    var name=row.dataset.name, href=row.dataset.href;
    var section=row.closest('.doc-section');
    drawer.hidden=false;
    drawer.innerHTML='<button type="button" class="doc-close" aria-label="Cerrar detalle del documento">×</button><div class="document-symbol">▤</div><h3>'+escape(name)+'</h3><p>Formato disponible en la biblioteca de Gio Filio</p><a class="btn btn--navy" href="'+escape(href)+'" download>↓ Descargar</a><dl><dt>Formato</dt><dd>PDF</dd><dt>Categoría</dt><dd>'+escape(section.querySelector('h3').textContent)+'</dd></dl><div class="document-note">Revisa que el formato corresponda a tu operación antes de utilizarlo.</div>';
    drawer.querySelector('.doc-close').onclick=function(){drawer.hidden=true;row.classList.remove('is-selected');};
  }
  root.querySelectorAll('.doc-section').forEach(function(section){
    var heading=document.createElement('p');heading.className='doc-section-sub';heading.textContent='Selecciona un documento para consultar su detalle o descargarlo.';section.querySelector('h3').after(heading);
    var search=document.createElement('input');search.type='search';search.className='doc-search';search.placeholder='Buscar documento…';search.setAttribute('aria-label','Buscar documento en esta categoría');heading.after(search);
    var grid=section.querySelector('.doc-grid');
    grid.querySelectorAll('a.doc-card').forEach(function(link){
      var name=link.querySelector('span:last-child').textContent;
      var row=document.createElement('div');row.className='doc-row';row.dataset.name=name;row.dataset.href=link.getAttribute('href');
      row.innerHTML='<button type="button" class="doc-select"><span class="doc-file-icon">▤</span><span><strong>'+escape(name)+'</strong><small>Documento de la biblioteca</small></span></button><span class="doc-format">PDF</span><a class="btn btn--ghost btn--sm" href="'+escape(row.dataset.href)+'" download>↓ Descargar</a>';
      link.replaceWith(row);row.querySelector('button').onclick=function(){select(row);};
    });
    search.oninput=function(){var q=search.value.toLocaleLowerCase('es');var count=0;grid.querySelectorAll('.doc-row').forEach(function(row){row.hidden=!row.dataset.name.toLocaleLowerCase('es').includes(q);if(!row.hidden)count++;});section.querySelector('.doc-no-results').hidden=count>0;};
    var empty=document.createElement('p');empty.className='doc-no-results';empty.hidden=true;empty.textContent='No hay documentos que coincidan con tu búsqueda.';grid.after(empty);
  });
  document.addEventListener('gf:doc-category',function(e){
    var section=document.getElementById(e.detail);section.querySelector('.doc-search').value='';section.querySelectorAll('.doc-row').forEach(function(r){r.hidden=false;});section.querySelector('.doc-no-results').hidden=true;
    var first=section.querySelector('.doc-row');if(first)select(first);
  });
})();
