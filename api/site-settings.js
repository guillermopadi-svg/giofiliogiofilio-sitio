// Published brand settings are public; drafts and every write require an active admin.
const {randomUUID}=require('node:crypto');
const KEY='giofilio:site-settings:v1';
const defaults={navy:'#071F4A',gold:'#B88E3E',icon:'/assets/img/brand/isotipo-gf.png',wordmark:'/assets/img/brand/wordmark.png',footerLogo:'/assets/img/brand/isotipo-blanco.png',hero:['/assets/img/hero/cdmx-reforma-real.jpg','/assets/img/hero/cdmx-chapultepec-real.jpg','/assets/img/brand/sidebar-angel-cdmx.webp']};
function validate(value,base){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid');
 const out={};
 for(const k of ['navy','gold']){if(!/^#[0-9a-f]{6}$/i.test(value[k]||''))throw Error('invalid');out[k]=value[k].toUpperCase();}
 function image(v){
  if(typeof v!=='string'||v.length>1000)throw Error('invalid');
  const u=new URL(v,'https://www.giofilio.com');
  const local=u.origin==='https://www.giofilio.com'&&u.pathname.startsWith('/assets/img/');
  const uploaded=u.origin===new URL(base).origin&&u.pathname.startsWith('/storage/v1/object/public/propiedades-manual/site-brand/');
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||(!local&&!uploaded)||!(/\.(png|jpe?g|webp)$/i.test(u.pathname)))throw Error('invalid');
  return local?u.pathname:u.href;
 }
 for(const k of ['icon','wordmark','footerLogo'])out[k]=image(value[k]);
 if(!Array.isArray(value.hero)||value.hero.length!==3)throw Error('invalid');
 out.hero=value.hero.map(image);return out;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'method_not_allowed'});
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const redis=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
 if(!base||!key||!redis||!token)return res.status(503).json({error:'unavailable'});
 const admin=req.method==='POST'||req.query?.mode==='admin';
 const sh={apikey:key,Authorization:`Bearer ${key}`};
 async function command(...args){const r=await fetch(redis,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('upstream');const d=await r.json();if(d.error)throw Error('upstream');return d.result;}
 try{
 let user;
 if(admin){
  const bearer=req.headers.authorization||'';
  if(!/^Bearer \S+$/i.test(bearer))return res.status(401).json({error:'unauthorized'});
  const r=await fetch(`${base}/auth/v1/user`,{headers:{apikey:key,Authorization:bearer},signal:AbortSignal.timeout(10000)});
  if(!r.ok)return res.status(401).json({error:'unauthorized'});user=await r.json();
  if(!/^[0-9a-f-]{36}$/i.test(user.id||''))return res.status(401).json({error:'unauthorized'});
  const pr=await fetch(`${base}/rest/v1/perfiles?id=eq.${user.id}&select=activo,rol`,{headers:sh,signal:AbortSignal.timeout(10000)});
  if(!pr.ok)throw Error('upstream');const profiles=await pr.json();
  if(!profiles.some(p=>p.activo===true&&p.rol==='admin'))return res.status(403).json({error:'forbidden'});
 }
 let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body);}catch{return res.status(400).json({error:'invalid'});}}
 if(req.method==='POST'&&body?.action==='upload'){
  if(!['image/png','image/jpeg','image/webp'].includes(body.type)||typeof body.data!=='string'||body.data.length>4000000||!(/^[A-Za-z0-9+/]+={0,2}$/.test(body.data)))return res.status(400).json({error:'invalid_image'});
  const bytes=Buffer.from(body.data,'base64');
  const type=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(type!==body.type||bytes.length<16||bytes.length>3000000)return res.status(400).json({error:'invalid_image'});
  const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[type];const path=`site-brand/${randomUUID()}.${ext}`;
  const up=await fetch(`${base}/storage/v1/object/propiedades-manual/${path}`,{method:'POST',headers:{...sh,'Content-Type':type,'Cache-Control':'3600'},body:bytes,signal:AbortSignal.timeout(20000)});
  if(!up.ok)throw Error('upstream');return res.status(200).json({url:`${base}/storage/v1/object/public/propiedades-manual/${path}`});
 }
 const raw=await command('GET',KEY);
 const state=raw?JSON.parse(raw):{revision:0,published:defaults,draft:defaults,previous:null};
 if(req.method==='GET')return res.status(200).json(admin?state:{published:state.published});
 if(!body||!Number.isSafeInteger(body.revision)||!['save','publish','restore'].includes(body.action))return res.status(400).json({error:'invalid'});
 if(body.revision!==state.revision)return res.status(409).json({error:'conflict'});
 const next={...state,revision:state.revision+1,updatedAt:new Date().toISOString(),updatedBy:user.id};
 if(body.action==='save'){try{next.draft=validate(body.settings,base);}catch{return res.status(400).json({error:'invalid_settings'});}}
 if(body.action==='publish'){next.previous=state.published;next.published=state.draft;next.publishedAt=next.updatedAt;}
 if(body.action==='restore'){if(!state.previous)return res.status(400).json({error:'no_previous'});next.previous=state.published;next.published=state.previous;next.draft=state.previous;next.publishedAt=next.updatedAt;}
 // Atomic optimistic locking prevents one administrator overwriting another's work.
 const lua="local v=redis.call('GET',KEYS[1]); if (v or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
 const saved=await command('EVAL',lua,1,KEY,raw||'',JSON.stringify(next));
 if(saved!==1)return res.status(409).json({error:'conflict'});
 return res.status(200).json(next);
 }catch{return res.status(502).json({error:'settings_unavailable'});}
};
module.exports.validate=validate;
