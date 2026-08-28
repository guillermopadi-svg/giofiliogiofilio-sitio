const ALLOWED_ORIGINS = new Set([
  'https://giofilio.com',
  'https://www.giofilio.com',
  'https://giofilio-sitio.vercel.app',
  'https://giofilio-sitio-memopadi.vercel.app',
  'https://giofilio-sitio-git-main-memopadi.vercel.app',
  'https://giofilio-sitio-git-preview-memopadi.vercel.app',
]);
// Previews de Vercel (ramas/PRs) tienen dominios generados al vuelo.
const PREVIEW_ORIGIN_RE = /^https:\/\/giofilio-sitio-[a-z0-9]+-memopadi\.vercel\.app$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// El sitio manda bastante más que nombre/email/telefono/mensaje: contexto
// de la propiedad (precio, recámaras, foto...), UTMs, referrer, etc. — ver
// captureLead() en gio.js. En vez de una lista fija por nombre de campo
// (que se desincroniza en cuanto se agregue un campo nuevo del lado del
// sitio), se acota de forma genérica: máximo de campos y de largo por
// campo, y se recorta cualquier valor no-string a su representación.
const MAX_CAMPOS = 40;
const MAX_LARGO_CAMPO = 4000;

function esOrigenValido(origin) {
  return !!origin && (ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN_RE.test(origin));
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  // CORS acotado al propio sitio: un formulario legítimo del sitio siempre
  // manda Origin; scripts de otros dominios que intenten llenar el
  // formulario desde el navegador de un visitante quedan bloqueados por
  // el navegador al no coincidir el Origin. No frena un abuso scripteado
  // directo (curl/requests, sin navegador de por medio) — eso requiere
  // rate-limiting con almacenamiento compartido (Upstash/Vercel KV), que
  // no está conectado todavía.
  if (esOrigenValido(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const raw = req.body || {};

  if (!raw.nombre || (!raw.email && !raw.telefono)) {
    res.status(400).json({ ok: false, error: 'faltan_datos_del_lead' });
    return;
  }
  if (raw.email && !EMAIL_RE.test(String(raw.email))) {
    res.status(400).json({ ok: false, error: 'email_invalido' });
    return;
  }

  const claves = Object.keys(raw).slice(0, MAX_CAMPOS);
  if (Object.keys(raw).length > MAX_CAMPOS) {
    res.status(400).json({ ok: false, error: 'payload_demasiado_grande' });
    return;
  }

  // Se recorta cada valor a un largo razonable antes de reenviarlo — evita
  // que un envío con campos absurdamente largos llegue tal cual al webhook
  // de n8n (y de ahí al prompt del asistente que redacta la respuesta
  // automática al lead).
  const lead = {};
  for (const campo of claves) {
    const v = raw[campo];
    if (v == null) continue;
    lead[campo] = typeof v === 'string' ? v.slice(0, MAX_LARGO_CAMPO) : v;
  }

  const webhookUrl = process.env.N8N_LEADS_WEBHOOK_URL;

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      });
    } catch (err) {
      console.error('[api/leads] fallo reenviando a n8n:', err.message);
    }
  } else {
    console.warn('[api/leads] N8N_LEADS_WEBHOOK_URL no esta configurada, el lead no se reenvio');
  }

  res.status(200).json({ ok: true });
};
