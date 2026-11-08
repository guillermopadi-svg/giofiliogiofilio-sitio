// Dedicated Santa Fe gallery: public photos only; provisioning requires an active admin.
const seed = require('../assets/data/santa-fe-panel.json');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control','no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'method_not_allowed'});
  const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base || !key) return res.status(503).json({error:'unavailable'});
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  const path=`${base}/rest/v1/propiedades_manual?id=eq.${seed.id}`;
  try {
    let user;
    if(req.method==='POST') {
      const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
      if(!token) return res.status(401).json({error:'unauthorized'});
      const auth=await fetch(`${base}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
      if(!auth.ok) return res.status(401).json({error:'unauthorized'});
      user=await auth.json();
      if(!/^[0-9a-f-]{36}$/i.test(user.id||'')) return res.status(401).json({error:'unauthorized'});
      const profile=await fetch(`${base}/rest/v1/perfiles?id=eq.${user.id}&select=activo,rol`,{headers});
      if(!profile.ok) return res.status(403).json({error:'forbidden'});
      const profiles=await profile.json();
      if(!profiles.some(p=>p.activo===true && p.rol==='admin'))return res.status(403).json({error:'forbidden'});
    }
    const read=await fetch(path+'&select=fotos,estado',{headers});
    if(!read.ok) throw new Error('read_failed');
    const rows=await read.json();
    if(req.method==='POST') {
      if(!rows.length){
        const insert=await fetch(`${base}/rest/v1/propiedades_manual?on_conflict=id`,{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({...seed,asesor_id:user.id})});
        if(!insert.ok) throw new Error('insert_failed');
      }
      return res.status(200).json({ok:true,id:seed.id});
    }
    // Never expose seller details, owner ids, internal notes or draft properties.
    if(!rows.length) return res.status(200).json({fotos:seed.fotos});
    if(rows[0].estado!=='disponible') return res.status(200).json({fotos:[]});
    const storageHost=new URL(base).origin;
    const fotos=(rows[0].fotos||[]).filter(value=>{
      try {const u=new URL(value);return u.protocol==='https:' && ((u.origin==='https://www.giofilio.com' && u.pathname.startsWith('/assets/img/propiedades/espacio-santa-fe-piso-18/')) || (u.origin===storageHost && u.pathname.startsWith('/storage/v1/object/public/propiedades-manual/')));}catch{return false;}
    });
    return res.status(200).json({fotos});
  } catch {return res.status(502).json({error:'gallery_unavailable'});}
};
