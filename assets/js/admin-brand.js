(function(){
 'use strict';
 var root=document.getElementById('brandEditor');if(!root)return;
 var fields=document.getElementById('brandFields'),status=document.getElementById('brandStatus'),assets=document.getElementById('brandAssets');
 var state,draft,getToken,busy=false,dirty=false,loaded=false;
 var slots=[['icon','Símbolo del encabezado'],['wordmark','Logotipo del encabezado'],['footerLogo','Logo del pie de página'],['hero0','Foto de portada 1'],['hero1','Foto de portada 2'],['hero2','Foto de portada 3']];
 function tell(t){status.textContent=t;}
 function value(k){return k.indexOf('hero')===0?draft.hero[Number(k.slice(4))]:draft[k];}
 function setValue(k,v){if(k.indexOf('hero')===0)draft.hero[Number(k.slice(4))]=v;else draft[k]=v;}
 function controls(){fields.disabled=busy||!state;document.getElementById('brandPublish').disabled=busy||dirty||!state||JSON.stringify(state.draft)===JSON.stringify(state.published);document.getElementById('brandRestore').disabled=busy||!state||!state.previous;}
 function changed(){dirty=true;controls();tell('Cambios sin guardar. Guarda el borrador antes de publicar.');}
 async function api(body){
  var token=await getToken();if(!token)throw Error('La sesión caducó. Vuelve a iniciar sesión.');
  var r=await fetch('/api/site-settings'+(body?'':'?mode=admin'),{method:body?'POST':'GET',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!r.ok){if(r.status===409)throw Error('Otro administrador hizo cambios. Recarga Configuración antes de continuar.');if(r.status===401||r.status===403)throw Error('Solo una cuenta administradora activa puede guardar estos cambios.');throw Error('No se pudo guardar o cargar la configuración. Intenta de nuevo.');}
  return r.json();
 }
 function render(){
  document.getElementById('brandNavy').value=draft.navy;document.getElementById('brandGold').value=draft.gold;assets.replaceChildren();
  slots.forEach(function(pair){var k=pair[0],box=document.createElement('div'),img=document.createElement('img'),label=document.createElement('label'),input=document.createElement('input');box.className='brand-asset';img.src=value(k);img.alt=pair[1];label.textContent=pair[1];input.type='file';input.accept='image/png,image/jpeg,image/webp';input.setAttribute('aria-label','Cambiar '+pair[1].toLowerCase());input.addEventListener('change',function(){if(input.files[0])upload(k,input.files[0]);});label.appendChild(input);box.append(img,label);assets.appendChild(box);});controls();
 }
 async function upload(k,file){
  if(busy)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024){tell('Usa una imagen JPG, PNG o WebP de hasta 15 MB.');return;}
  busy=true;controls();tell('Optimizando y subiendo imagen…');var bitmap;
  try{
   bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
   var scale=Math.min(1,(k.indexOf('hero')===0?1920:1000)/Math.max(bitmap.width,bitmap.height));
   var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
   var data=canvas.toDataURL(k.indexOf('hero')===0?'image/jpeg':'image/png',.85);var type=data.slice(5,data.indexOf(';'));var result=await api({action:'upload',type:type,data:data.split(',')[1]});setValue(k,result.url);changed();render();
  }catch(e){tell(e.message||'No pudimos abrir la imagen. Exporta una copia en JPG o PNG.');}finally{if(bitmap)bitmap.close();busy=false;controls();}
 }
 document.getElementById('brandNavy').addEventListener('input',function(e){draft.navy=e.target.value;changed();});
 document.getElementById('brandGold').addEventListener('input',function(e){draft.gold=e.target.value;changed();});
 async function mutate(action){if(busy||!state)return;busy=true;controls();tell(action==='save'?'Guardando borrador…':'Aplicando publicación…');try{state=await api({action:action,revision:state.revision,settings:action==='save'?draft:undefined});draft=JSON.parse(JSON.stringify(state.draft));dirty=false;render();tell(action==='save'?'Borrador guardado. El sitio público no cambió.':action==='restore'?'Versión anterior restaurada en el sitio público.':'Cambios publicados en el sitio.');}catch(e){tell(e.message);}finally{busy=false;controls();}}
 document.getElementById('brandSave').addEventListener('click',function(){mutate('save');});
 document.getElementById('brandPublish').addEventListener('click',function(){mutate('publish');});
 document.getElementById('brandRestore').addEventListener('click',function(){mutate('restore');});
 var frame=document.getElementById('brandFrame');
 function sendPreview(){if(draft&&frame.contentWindow)frame.contentWindow.postMessage({type:'gf-brand-preview',settings:draft},location.origin);}
 document.getElementById('brandPreview').addEventListener('click',function(){document.getElementById('brandPreviewWrap').hidden=false;if(!frame.getAttribute('src'))frame.src='/?gf_brand_preview=1';else sendPreview();});
 window.addEventListener('message',function(e){if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data&&e.data.type==='gf-brand-ready')sendPreview();});
 window.GF_BRAND_EDITOR={open:function(admin,tokenProvider){root.hidden=!admin;if(!admin)return;getToken=tokenProvider;if(loaded||busy)return;busy=true;controls();api().then(function(data){state=data;draft=JSON.parse(JSON.stringify(state.draft));loaded=true;render();tell('Los cambios se publican solo cuando pulses «Publicar cambios».');}).catch(function(e){tell(e.message);}).finally(function(){busy=false;controls();});}};
})();
