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

// Rate-limiting por IP contra el abuso scripteado directo (curl/bots), que
// el CORS de arriba no frena. Se usa la REST API de Upstash Redis en vez de
// su SDK para no meter una dependencia de npm en un proyecto que hoy no
// tiene package.json. Si Upstash no está configurado o falla, se deja pasar
// el lead (fail-open) — nunca perder un lead real por una caída de un
// servicio de soporte.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

async function upstash(...command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error('[api/leads] Upstash respondio', res.status);
      return null;
    }
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error('[api/leads] fallo consultando Upstash:', err.message);
    return null;
  }
}

async function excedeLimite(ip) {
  const count = await upstash('INCR', `ratelimit:leads:${ip}`);
  if (count === null) return false;
  if (count === 1) await upstash('EXPIRE', `ratelimit:leads:${ip}`, String(RATE_LIMIT_WINDOW_SECONDS));
  return count > RATE_LIMIT_MAX;
}

// Guarda una copia del lead en Supabase para que el panel de asesores
// (sección Contactos) lo muestre y se pueda dar seguimiento. n8n sigue
// siendo el que dispara la respuesta automática — esto es en paralelo, no
// en vez de. Fail-open igual que Upstash: si Supabase no está configurado
// o falla, nunca se bloquea ni se pierde el lead real.
async function guardarEnSupabase(lead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const {
    nombre, email, telefono, mensaje, fuente, formulario,
    propiedad_id, propiedad_titulo, propiedad_precio, operacion, colonia,
    url: pagina_url,
    ...resto
  } = lead;

  const fila = {
    nombre,
    email: email || null,
    telefono: telefono || null,
    mensaje: mensaje || null,
    fuente: fuente || 'sitio_web',
    formulario: formulario || 'contacto',
    propiedad_id: propiedad_id || null,
    propiedad_titulo: propiedad_titulo || null,
    propiedad_precio: propiedad_precio || null,
    operacion: operacion || null,
    colonia: colonia || null,
    pagina_url: pagina_url || null,
    contexto: resto,
  };

  try {
    const res = await fetch(`${url}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(fila),
    });
    if (!res.ok) {
      console.error('[api/leads] Supabase respondio', res.status, await res.text());
    }
  } catch (err) {
    console.error('[api/leads] fallo guardando en Supabase:', err.message);
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  // CORS acotado al propio sitio: un formulario legítimo del sitio siempre
  // manda Origin; scripts de otros dominios que intenten llenar el
  // formulario desde el navegador de un visitante quedan bloqueados por
  // el navegador al no coincidir el Origin. El abuso scripteado directo
  // (curl/requests, sin navegador de por medio) lo frena el rate-limiting
  // por IP de más abajo (excedeLimite), respaldado en Upstash Redis.
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

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (await excedeLimite(ip)) {
    res.status(429).json({ ok: false, error: 'demasiados_intentos' });
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

  const reenviarAN8n = webhookUrl
    ? fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      }).catch((err) => console.error('[api/leads] fallo reenviando a n8n:', err.message))
    : Promise.resolve(console.warn('[api/leads] N8N_LEADS_WEBHOOK_URL no esta configurada, el lead no se reenvio'));

  await Promise.all([reenviarAN8n, guardarEnSupabase(lead)]);

  res.status(200).json({ ok: true });
};
