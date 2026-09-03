// Dispara la reconstrucción del sitio (workflow sync-manual.yml) justo
// después de que un asesor publica/edita/borra una propiedad en /admin/,
// en vez de esperar al respaldo por hora. Solo hace un `repository_dispatch`
// — el mismo build seguro y ya probado corre del lado de GitHub Actions,
// aquí no se toca el repo directamente.
//
// No usa un secreto propio: valida el access token de Supabase que manda
// el panel contra la API de Supabase (GET /auth/v1/user). Si el token
// pertenece a un usuario real y autenticado, se dispara el rebuild.

const ALLOWED_ORIGINS = new Set([
  'https://giofilio.com',
  'https://www.giofilio.com',
  'https://giofilio-sitio.vercel.app',
  'https://giofilio-sitio-memopadi.vercel.app',
  'https://giofilio-sitio-git-main-memopadi.vercel.app',
  'https://giofilio-sitio-git-preview-memopadi.vercel.app',
]);
const PREVIEW_ORIGIN_RE = /^https:\/\/giofilio-sitio-[a-z0-9]+-memopadi\.vercel\.app$/;

const RATE_LIMIT_MAX = 6;
const RATE_LIMIT_WINDOW_SECONDS = 600;

function esOrigenValido(origin) {
  return !!origin && (ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN_RE.test(origin));
}

async function upstash(...command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()).result;
  } catch {
    return null;
  }
}

async function excedeLimite(key) {
  const count = await upstash('INCR', `ratelimit:rebuild:${key}`);
  if (count === null) return false;
  if (count === 1) await upstash('EXPIRE', `ratelimit:rebuild:${key}`, String(RATE_LIMIT_WINDOW_SECONDS));
  return count > RATE_LIMIT_MAX;
}

async function usuarioValido(accessToken) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || !accessToken) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (esOrigenValido(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const accessToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!(await usuarioValido(accessToken))) {
    res.status(401).json({ ok: false, error: 'no_autenticado' });
    return;
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (await excedeLimite(ip)) {
    res.status(429).json({ ok: false, error: 'demasiados_intentos' });
    return;
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO; // ej. "guillermopadi-svg/giofiliogiofilio-sitio"
  if (!token || !repo) {
    console.warn('[api/rebuild] GITHUB_DISPATCH_TOKEN / GITHUB_DISPATCH_REPO no configurados — el respaldo por hora igual recogerá el cambio.');
    res.status(200).json({ ok: true, inmediato: false });
    return;
  }

  try {
    const ghRes = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'manual-props-updated' }),
    });
    if (!ghRes.ok) {
      console.error('[api/rebuild] GitHub respondió', ghRes.status, await ghRes.text());
      res.status(200).json({ ok: true, inmediato: false });
      return;
    }
  } catch (err) {
    console.error('[api/rebuild] fallo llamando a GitHub:', err.message);
    res.status(200).json({ ok: true, inmediato: false });
    return;
  }

  res.status(200).json({ ok: true, inmediato: true });
};
