const ALLOWED_ORIGINS = new Set([
  'https://giofilio.com',
  'https://www.giofilio.com',
  'https://giofilio-sitio.vercel.app',
  'https://giofilio-sitio-memopadi.vercel.app',
  'https://giofilio-sitio-git-main-memopadi.vercel.app',
  'https://giofilio-sitio-git-preview-memopadi.vercel.app',
]);
const PREVIEW_ORIGIN_RE = /^https:\/\/giofilio-sitio-[a-z0-9]+-memopadi\.vercel\.app$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LARGO_TEXTO = 4000;
const MAX_FOTOS = 30;

function esOrigenValido(origin) {
  return !!origin && (ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN_RE.test(origin));
}

// Mismo esquema de rate-limiting que api/leads.js -- ver ese archivo para
// el razonamiento completo (fail-open si Upstash no esta configurado).
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
      console.error('[api/alta-propiedad] Upstash respondio', res.status);
      return null;
    }
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error('[api/alta-propiedad] fallo consultando Upstash:', err.message);
    return null;
  }
}

async function excedeLimite(ip) {
  const count = await upstash('INCR', `ratelimit:alta:${ip}`);
  if (count === null) return false;
  if (count === 1) await upstash('EXPIRE', `ratelimit:alta:${ip}`, String(RATE_LIMIT_WINDOW_SECONDS));
  return count > RATE_LIMIT_MAX;
}

function texto(v, max) {
  if (v == null) return '';
  return String(v).slice(0, max || MAX_LARGO_TEXTO);
}

function entero(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
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

  if (!raw.nombre || !raw.telefono) {
    res.status(400).json({ ok: false, error: 'faltan_datos_de_contacto' });
    return;
  }
  if (raw.email && !EMAIL_RE.test(String(raw.email))) {
    res.status(400).json({ ok: false, error: 'email_invalido' });
    return;
  }
  if (!['venta', 'renta'].includes(raw.operacion)) {
    res.status(400).json({ ok: false, error: 'operacion_invalida' });
    return;
  }
  if (!raw.tipo) {
    res.status(400).json({ ok: false, error: 'falta_tipo_de_propiedad' });
    return;
  }

  const fotos = Array.isArray(raw.fotos) ? raw.fotos.slice(0, MAX_FOTOS).map((f) => texto(f, 500)) : [];
  const amenidades = Array.isArray(raw.amenidades) ? raw.amenidades.slice(0, 40).map((a) => texto(a, 60)) : [];

  const fila = {
    nombre: texto(raw.nombre, 120),
    apellido: texto(raw.apellido, 120),
    telefono: texto(raw.telefono, 40),
    email: texto(raw.email, 200),
    operacion: raw.operacion,
    tipo: texto(raw.tipo, 40),
    precio: numero(raw.precio),
    calle: texto(raw.calle, 200),
    numero: texto(raw.numero, 40),
    colonia: texto(raw.colonia, 120),
    alcaldia: texto(raw.alcaldia, 120),
    cp: texto(raw.cp, 10),
    rec: entero(raw.rec),
    ban: entero(raw.ban),
    est: entero(raw.est),
    m2c: entero(raw.m2c),
    m2t: entero(raw.m2t),
    antig: entero(raw.antig),
    amenidades,
    descripcion: texto(raw.descripcion, MAX_LARGO_TEXTO),
    fotos,
  };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[api/alta-propiedad] Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno');
    res.status(500).json({ ok: false, error: 'servicio_no_configurado' });
    return;
  }

  try {
    const supaRes = await fetch(`${url}/rest/v1/solicitudes_alta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(fila),
    });
    if (!supaRes.ok) {
      console.error('[api/alta-propiedad] Supabase respondio', supaRes.status, await supaRes.text());
      res.status(502).json({ ok: false, error: 'no_se_pudo_guardar' });
      return;
    }
  } catch (err) {
    console.error('[api/alta-propiedad] fallo guardando en Supabase:', err.message);
    res.status(502).json({ ok: false, error: 'no_se_pudo_guardar' });
    return;
  }

  res.status(200).json({ ok: true });
};
