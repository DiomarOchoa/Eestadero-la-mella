// backend/src/utils/paginacion.js
// Paginación estándar para listados multi-tenant.
// Uso: const { page, limit, offset } = obtenerPaginacion(req.query);
// Siempre devuelve LIMIT/OFFSET seguros para SQL.

function obtenerPaginacion(query = {}, { porDefecto = 20, maximo = 100 } = {}) {
  let page = Number(query.page || 1);
  let limit = Number(query.limit || query.limite || porDefecto);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = porDefecto;
  if (limit > maximo) limit = maximo;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function respuestaPaginada({ page, limit, total, datos, clave = 'datos' }) {
  const totalPaginas = Math.max(1, Math.ceil(Number(total || 0) / limit));
  return {
    ok: true,
    [clave]: datos,
    paginacion: { pagina: page, limite: limit, total: Number(total || 0), totalPaginas },
  };
}

module.exports = { obtenerPaginacion, respuestaPaginada };
