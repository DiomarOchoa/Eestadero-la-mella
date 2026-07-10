const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const TIPOS_VALIDOS = ['CERVEZA', 'BEBIDA', 'SNACK'];

/** GET /api/productos?tipo=&activo=&q= - listar / filtrar productos (para inventario y para agregar a cuentas) */
const listar = asyncHandler(async (req, res) => {
  const { tipo, activo, q } = req.query;
  const condiciones = [];
  const params = [];

  if (tipo) {
    params.push(tipo.toUpperCase());
    condiciones.push(`tipo = $${params.length}::tipo_producto`);
  }
  if (activo !== undefined) {
    params.push(activo === 'true');
    condiciones.push(`activo = $${params.length}`);
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    condiciones.push(`LOWER(nombre) LIKE $${params.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, nombre, tipo, precio, stock, stock_minimo, activo, creado_en
     FROM productos ${where} ORDER BY tipo, nombre`,
    params
  );
  res.json({ ok: true, productos: rows });
});

/** POST /api/productos - crear producto */
const crear = asyncHandler(async (req, res) => {
  const { nombre, tipo, precio, stock, stockMinimo } = req.body;

  if (!nombre || !tipo || precio === undefined) {
    throw new ApiError(400, 'nombre, tipo y precio son obligatorios.');
  }
  if (!TIPOS_VALIDOS.includes(tipo.toUpperCase())) {
    throw new ApiError(400, `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
  }
  if (Number(precio) < 0) throw new ApiError(400, 'El precio no puede ser negativo.');

  const { rows } = await query(
    `INSERT INTO productos (nombre, tipo, precio, stock, stock_minimo)
     VALUES ($1, $2::tipo_producto, $3, COALESCE($4, 0), COALESCE($5, 5))
     RETURNING *`,
    [nombre, tipo.toUpperCase(), precio, stock, stockMinimo]
  );

  res.status(201).json({ ok: true, producto: rows[0] });
});

/** PATCH /api/productos/:id - editar producto (precio, stock, nombre, activo, etc.) */
const actualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, precio, stock, stockMinimo, activo } = req.body;

  if (tipo && !TIPOS_VALIDOS.includes(tipo.toUpperCase())) {
    throw new ApiError(400, `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
  }

  const { rows: existentes } = await query('SELECT id FROM productos WHERE id = $1', [id]);
  if (!existentes[0]) throw new ApiError(404, 'Producto no encontrado.');

  const { rows } = await query(
    `UPDATE productos SET
        nombre = COALESCE($1, nombre),
        tipo = COALESCE($2::tipo_producto, tipo),
        precio = COALESCE($3, precio),
        stock = COALESCE($4, stock),
        stock_minimo = COALESCE($5, stock_minimo),
        activo = COALESCE($6, activo)
     WHERE id = $7
     RETURNING *`,
    [nombre, tipo ? tipo.toUpperCase() : null, precio, stock, stockMinimo, activo, id]
  );

  res.json({ ok: true, producto: rows[0] });
});

/** GET /api/productos/inventario/bajo-stock - productos por debajo del stock mínimo */
const bajoStock = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, tipo, stock, stock_minimo
     FROM productos WHERE activo = TRUE AND stock <= stock_minimo
     ORDER BY stock ASC`
  );
  res.json({ ok: true, productos: rows });
});

module.exports = { listar, crear, actualizar, bajoStock };
