module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

  const lead = req.body || {};

  if (!lead.nombre || (!lead.email && !lead.telefono)) {
    res.status(400).json({ ok: false, error: 'faltan_datos_del_lead' });
    return;
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
