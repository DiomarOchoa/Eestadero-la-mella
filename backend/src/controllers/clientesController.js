// backend/src/controllers/clientesController.js
// Versión multi-tenant.

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { obtenerPaginacion, respuestaPaginada } = require('../utils/paginacion');

/** GET /api/clientes?q= - listar/buscar clientes (usado en autocompletado) */
const listar = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const { page, limit, offset } = obtenerPaginacion(req.query, { porDefecto: 20, maximo: 100 });
  if (q) {
    const { rows } = await query(
      `SELECT id, referencia, notas, creado_en FROM clientes
       WHERE negocio_id = $1 AND LOWER(referencia) LIKE $2
       ORDER BY creado_en DESC LIMIT $3 OFFSET $4`,
      [req.negocioId, `%${q.toLowerCase()}%`, limit, offset]
    );
    return res.json(respuestaPaginada({ page, limit, total: rows.length, datos: rows, clave: 'clientes' }));
  }
  const [{ rows }, { rows: conteo }] = await Promise.all([
    query(
      `SELECT id, referencia, notas, creado_en FROM clientes
     WHERE negocio_id = $1 ORDER BY creado_en DESC LIMIT $2 OFFSET $3`,
      [req.negocioId, limit, offset]
    ),
    query('SELECT COUNT(*)::int AS total FROM clientes WHERE negocio_id = $1', [req.negocioId]),
  ]);
  res.json(respuestaPaginada({ page, limit, total: conteo[0].total, datos: rows, clave: 'clientes' }));
});

/** POST /api/clientes - crear referencia de cliente nueva */
const crear = asyncHandler(async (req, res) => {
  const { referencia, notas } = req.body;
  if (!referencia || !referencia.trim()) {
    throw new ApiError(400, 'La referencia del cliente es obligatoria (ej: "Luis", "Mesa 2").');
  }

  const { rows } = await query(
    `INSERT INTO clientes (negocio_id, referencia, notas) VALUES ($1, $2, $3) RETURNING *`,
    [req.negocioId, referencia.trim(), notas || null]
  );
  res.status(201).json({ ok: true, cliente: rows[0] });
});

module.exports = { listar, crear };
