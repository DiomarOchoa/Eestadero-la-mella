const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/** GET /api/clientes?q= - listar/buscar clientes (usado en autocompletado) */
const listar = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (q) {
    const { rows } = await query(
      `SELECT id, referencia, notas, creado_en FROM clientes
       WHERE LOWER(referencia) LIKE $1
       ORDER BY creado_en DESC LIMIT 10`,
      [`%${q.toLowerCase()}%`]
    );
    return res.json({ ok: true, clientes: rows });
  }
  const { rows } = await query(
    `SELECT id, referencia, notas, creado_en FROM clientes ORDER BY creado_en DESC LIMIT 100`
  );
  res.json({ ok: true, clientes: rows });
});

/** POST /api/clientes - crear referencia de cliente nueva */
const crear = asyncHandler(async (req, res) => {
  const { referencia, notas } = req.body;
  if (!referencia || !referencia.trim()) {
    throw new ApiError(400, 'La referencia del cliente es obligatoria (ej: "Luis", "Mesa 2").');
  }

  const { rows } = await query(
    `INSERT INTO clientes (referencia, notas) VALUES ($1, $2) RETURNING *`,
    [referencia.trim(), notas || null]
  );
  res.status(201).json({ ok: true, cliente: rows[0] });
});

module.exports = { listar, crear };
