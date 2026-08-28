const propiedades = require('../assets/data/propiedades.json');

function norm(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300');

  const q = req.query || {};
  const operacion = q.operacion ? norm(q.operacion) : null;
  const tipo = q.tipo ? norm(q.tipo) : null;
  const zona = q.zona ? norm(q.zona) : null;
  const precioMin = q.precio_min ? Number(q.precio_min) : null;
  const precioMax = q.precio_max ? Number(q.precio_max) : null;
  const recMin = q.rec_min ? Number(q.rec_min) : null;
  const limit = Math.min(Number(q.limit) || 5, 15);

  let lista = propiedades.propiedades.filter((p) => p.estado === 'disponible');

  if (operacion) lista = lista.filter((p) => norm(p.operacion) === operacion);
  if (tipo) lista = lista.filter((p) => norm(p.tipo).includes(tipo) || norm(p.tipo_label).includes(tipo));
  if (zona) {
    lista = lista.filter(
      (p) => norm(p.colonia_nombre).includes(zona) || norm(p.alcaldia_nombre).includes(zona)
    );
  }
  if (precioMin) lista = lista.filter((p) => p.precio >= precioMin);
  if (precioMax) lista = lista.filter((p) => p.precio <= precioMax);
  if (recMin) lista = lista.filter((p) => (p.rec || 0) >= recMin);

  const total_encontradas = lista.length;

  const resultado = lista.slice(0, limit).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    operacion: p.operacion,
    tipo: p.tipo_label,
    precio: p.precio,
    moneda: 'MXN',
    colonia: p.colonia_nombre,
    alcaldia: p.alcaldia_nombre,
    recamaras: p.rec,
    banos: p.ban,
    estacionamientos: p.est,
    m2_construccion: p.m2c,
    url: `https://giofilio.com/${p.url}`,
  }));

  res.status(200).json({ total_encontradas, mostrando: resultado.length, propiedades: resultado });
};
