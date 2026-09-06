// Invita a un nuevo asesor por correo. Solo Gio (o quien tenga rol 'admin')
// puede hacerlo -- crear un usuario de Supabase Auth requiere la
// service_role key, que nunca debe llegar al navegador, así que esto vive
// en un endpoint de servidor (mismo patron que api/rebuild.js).
//
// El panel manda el access_token de quien está logueado en el header
// Authorization; aquí se verifica con ESE token quién es (no se confía en
// nada que mande el body), y luego se checa en `perfiles` que su rol sea
// 'admin' antes de invitar a nadie.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method_not_allowed' }); return; }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(500).json({ ok: false, error: 'supabase_no_configurado' });
    return;
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ ok: false, error: 'falta_sesion' }); return; }

  const { nombre, email } = req.body || {};
  if (!email || !EMAIL_RE.test(String(email))) {
    res.status(400).json({ ok: false, error: 'correo_invalido' });
    return;
  }

  try {
    // 1. ¿Quién llama? -- se resuelve con SU PROPIO token, no con el de servicio.
    const quienRes = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!quienRes.ok) { res.status(401).json({ ok: false, error: 'sesion_invalida' }); return; }
    const quien = await quienRes.json();

    // 2. ¿Es admin? (se consulta con la service_role key, sin depender de RLS)
    const perfilRes = await fetch(
      `${url}/rest/v1/perfiles?id=eq.${quien.id}&select=rol`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const perfiles = await perfilRes.json();
    if (!Array.isArray(perfiles) || perfiles[0]?.rol !== 'admin') {
      res.status(403).json({ ok: false, error: 'solo_un_admin_puede_invitar' });
      return;
    }

    // 3. Invitar -- Supabase crea el usuario y le manda un correo con un link
    // para poner su contraseña (endpoint de administracion de GoTrue).
    const inviteRes = await fetch(`${url}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, data: { nombre: nombre || '' } }),
    });
    const inviteData = await inviteRes.json();
    if (!inviteRes.ok) {
      res.status(inviteRes.status).json({
        ok: false,
        error: inviteData.msg || inviteData.error_description || inviteData.error || 'no_se_pudo_invitar',
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/invitar-asesor] error:', err.message);
    res.status(500).json({ ok: false, error: 'error_interno' });
  }
};
