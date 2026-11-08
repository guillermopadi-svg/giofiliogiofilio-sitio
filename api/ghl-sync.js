// Read-only HighLevel integration. Writes only to Gio Filio's authenticated CRM.
const {createHash,timingSafeEqual}=require('node:crypto');
const clean=(v,n=500)=>typeof v==='string'?v.slice(0,n):'';
function leadId(location,contact){
 const h=createHash('sha256').update(`giofilio:ghl:${location}:${contact}`).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'method_not_allowed'});
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return res.status(503).json({error:'unavailable'});
 const bearer=req.headers.authorization||'';
 const hook=req.headers['x-ghl-webhook-secret'];
 const expected=process.env.GHL_WEBHOOK_SECRET;
 const isHook=req.method==='POST'&&typeof hook==='string'&&!!expected&&Buffer.byteLength(hook)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(hook),Buffer.from(expected));
 if(!isHook&&!/^Bearer \S+$/i.test(bearer))return res.status(401).json({error:'unauthorized'});
 const sh={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
 async function json(url,options={}){
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  if(!r.ok){const e=new Error('upstream');e.status=r.status;throw e;}
  return r.status===204?null:r.json();
 }
 try{
  if(!isHook){
  let user;
  try{user=await json(`${base}/auth/v1/user`,{headers:{apikey:key,Authorization:bearer}});}catch{return res.status(401).json({error:'unauthorized'});}
  if(!/^[0-9a-f-]{36}$/i.test(user.id||''))return res.status(401).json({error:'unauthorized'});
  const profiles=await json(`${base}/rest/v1/perfiles?id=eq.${user.id}&select=activo,rol`,{headers:sh});
  if(!profiles.some(p=>p.activo===true&&p.rol==='admin'))return res.status(403).json({error:'forbidden'});
  }
  const token=process.env.GHL_PRIVATE_TOKEN,location=process.env.GHL_LOCATION_ID?.trim();
  if(!token||!location)return res.status(503).json({error:'ghl_not_configured'});
  if(!/^[a-zA-Z0-9_-]{5,100}$/.test(location))return res.status(503).json({error:'ghl_location_invalid'});
  async function ghl(path,version='2021-04-15'){
   try{return await json('https://services.leadconnectorhq.com'+path,{headers:{Authorization:`Bearer ${token}`,Version:version,Accept:'application/json'}});}catch(e){e.ghl=true;throw e;}
  }
  const contactId=isHook?(req.body?.contact_id||req.body?.contactId):null;
  if(isHook&&!/^[a-zA-Z0-9_-]{5,100}$/.test(contactId||''))return res.status(400).json({error:'invalid_contact'});
  const cursor=isHook?null:req.body?.cursor;
  if(cursor!=null&&!/^\d{1,17}$/.test(String(cursor)))return res.status(400).json({error:'invalid_cursor'});
  // Inspect every conversation, not only those whose most recent channel is WhatsApp.
  const q=new URLSearchParams({locationId:location,limit:req.method==='GET'?'1':'20',sort:'desc',sortBy:'last_message_date'});
  if(contactId)q.set('contactId',contactId);
  if(cursor!=null)q.set('startAfterDate',String(cursor));
  async function available(path,version,ready){
   for(let attempt=0;attempt<4;attempt++){
    const data=await ghl(path,version);
    if(!isHook||ready(data)||attempt===3)return data;
    await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
   }
  }
  const result=await available('/conversations/search?'+q,'2021-04-15',d=>d.conversations?.length>0);
  if(!Array.isArray(result.conversations))throw new Error('invalid_response');
  if(req.method==='GET')return res.status(200).json({connected:true,totalConversations:result.total||0});
  const conversations=result.conversations;
  const rows=[];
  for(let i=0;i<conversations.length;i+=5){
   const batch=await Promise.all(conversations.slice(i,i+5).map(async c=>{
    if(c.locationId!==location||!c.contactId||!c.id)throw new Error('invalid_conversation');
    const data=await available(`/conversations/${encodeURIComponent(c.id)}/messages?type=TYPE_WHATSAPP&limit=30`,'2021-07-28',d=>d.messages?.messages?.length>0);
    if(!Array.isArray(data.messages?.messages))throw new Error('invalid_messages');
    const messages=data.messages.messages.slice(0,30).sort((a,b)=>(Date.parse(a.dateAdded)||0)-(Date.parse(b.dateAdded)||0));
    const m=messages.at(-1);
    const inbound=messages.filter(x=>x.direction==='inbound').at(-1);
    if(!m)return null;
    return {id:leadId(location,c.contactId),nombre:clean(c.fullName||c.contactName||c.phone||'Contacto de WhatsApp',200),
     telefono:clean(c.phone,40)||null,email:clean(c.email,250)||null,mensaje:clean((inbound||m).body,10000)||'Mensaje de WhatsApp sin texto',
     fuente:'whatsapp_gohighlevel',formulario:'whatsapp',contexto:{ghl_location_id:location,ghl_contact_id:c.contactId,ghl_conversation_id:c.id,ghl_message_id:m.id,ultimo_mensaje_en:m.dateAdded||null,direccion:m.direction||null,whatsapp_mensajes:messages.map(x=>({id:clean(x.id,150),texto:clean(x.body,10000),fecha:clean(x.dateAdded,60)||null,direccion:clean(x.direction,20)}))}};
   }));rows.push(...batch.filter(Boolean));
  }
  if(isHook&&!rows.length){
   res.setHeader('Retry-After','10');
   return res.status(503).json({error:'ghl_message_pending'});
  }
  if(rows.length){
   // Stable contact key + upsert: repeated/concurrent syncs cannot duplicate imported leads.
   // Omit estado, asesor_id and notas so syncing never resets the team's work.
   const ids=[...new Set(rows.map(r=>r.id))];
   const existing=await json(`${base}/rest/v1/leads?id=in.(${ids.join(',')})&select=id,nombre,telefono,email,contexto`,{headers:sh});
   for(const row of rows){
    const prior=existing.find(x=>x.id===row.id);
    if(prior?.contexto?.crm_fields_edited){for(const k of ['nombre','telefono','email'])row[k]=prior[k];}
    row.contexto={...(prior?.contexto||{}),...row.contexto};
   }
   await json(`${base}/rest/v1/leads?on_conflict=id`,{method:'POST',headers:{...sh,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([...new Map(rows.map(r=>[r.id,r])).values()])});
  }
  const last=conversations.at(-1),date=last?.lastMessageDate;
  const more=conversations.length===20;
  const next=more&&/^\d{1,17}$/.test(String(date))&&String(date)!==String(cursor)?String(date):null;
  return res.status(200).json({ok:true,synced:rows.length,reviewed:conversations.length,nextCursor:next,incomplete:more&&!next});
 }catch(e){return res.status(502).json({error:e.ghl?(e.status===401||e.status===403?'ghl_access_denied':'ghl_unavailable'):'sync_failed'});}
};
module.exports.leadId=leadId;
