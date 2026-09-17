const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const TIPOS_VALIDOS = ['CERVEZA', 'BEBIDA', 'SNACK'];

/** GET /api/productos?tipo=&activo=&q= - listar / filtrar productos */
const listar = asyncHandler(async (req, res) => {
  const { tipo, activo, q } = req.query;
  const condiciones = [];
  const params = [];

  if (tipo) {
    const tipoNormalizado = String(tipo).toUpperCase();
    if (!TIPOS_VALIDOS.includes(tipoNormalizado)) {
      throw new ApiError(400, `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
    }
    params.push(tipoNormalizado);
    condiciones.push(`tipo = $${params.length}::tipo_producto`);
  }

  if (activo !== undefined) {
    if (activo !== 'true' && activo !== 'false') {
      throw new ApiError(400, 'activo debe ser true o false.');
    }
    params.push(activo === 'true');
    condiciones.push(`activo = $${params.length}`);
  }

  if (q) {
    params.push(`%${String(q).trim().toLowerCase()}%`);
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
  const nombre = String(req.body.nombre || '').trim();
  const tipo = String(req.body.tipo || '').toUpperCase();
  const precio = Number(req.body.precio);
  const stock = req.body.stock === undefined ? 0 : Number(req.body.stock);
  const stockMinimo = req.body.stockMinimo === undefined ? 5 : Number(req.body.stockMinimo);

  if (!nombre || !tipo || req.body.precio === undefined) {
    throw new ApiError(400, 'nombre, tipo y precio son obligatorios.');
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new ApiError(400, `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
  }
  if (!Number.isFinite(precio) || precio < 0) throw new ApiError(400, 'El precio no es válido.');
  if (!Number.isInteger(stock) || stock < 0) throw new ApiError(400, 'El stock debe ser un entero mayor o igual a 0.');
  if (!Number.isInteger(stockMinimo) || stockMinimo < 0) throw new ApiError(400, 'El stock mínimo debe ser un entero mayor o igual a 0.');

  const { rows } = await query(
    `INSERT INTO productos (nombre, tipo, precio, stock, stock_minimo)
     VALUES ($1, $2::tipo_producto, $3, $4, $5)
     RETURNING *`,
    [nombre, tipo, precio, stock, stockMinimo]
  );

  res.status(201).json({ ok: true, producto: rows[0] });
});

/** PATCH /api/productos/:id - editar producto */
const actualizar = asyncHandler(async (req, res) => {
  const idNum = Number(req.params.id);
  const { nombre, tipo, precio, stock, stockMinimo, activo } = req.body;

  if (!Number.isInteger(idNum) || idNum <= 0) throw new ApiError(400, 'ID de producto inválido.');

  if (tipo !== undefined && !TIPOS_VALIDOS.includes(String(tipo).toUpperCase())) {
    throw new ApiError(400, `tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
  }
  if (nombre !== undefined && !String(nombre).trim()) throw new ApiError(400, 'El nombre no puede estar vacío.');
  if (precio !== undefined && (!Number.isFinite(Number(precio)) || Number(precio) < 0)) {
    throw new ApiError(400, 'El precio no es válido.');
  }
  if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) {
    throw new ApiError(400, 'El stock debe ser un entero mayor o igual a 0.');
  }
  if (stockMinimo !== undefined && (!Number.isInteger(Number(stockMinimo)) || Number(stockMinimo) < 0)) {
    throw new ApiError(400, 'El stock mínimo debe ser un entero mayor o igual a 0.');
  }
  if (activo !== undefined && typeof activo !== 'boolean') {
    throw new ApiError(400, 'activo debe ser verdadero o falso.');
  }

  const { rows: existentes } = await query('SELECT id FROM productos WHERE id = $1', [idNum]);
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
    [
      nombre === undefined ? null : String(nombre).trim(),
      tipo === undefined ? null : String(tipo).toUpperCase(),
      precio === undefined ? null : Number(precio),
      stock === undefined ? null : Number(stock),
      stockMinimo === undefined ? null : Number(stockMinimo),
      activo === undefined ? null : activo,
      idNum,
    ]
  );

  res.json({ ok: true, producto: rows[0] });
});

/**
 * DELETE /api/productos/:id - eliminar producto definitivamente.
 * Si tiene historial, se debe desactivar para conservar las ventas anteriores.
 */
const eliminar = asyncHandler(async (req, res) => {
  const idNum = Number(req.params.id);
  if (!Number.isInteger(idNum) || idNum <= 0) throw new ApiError(400, 'ID de producto inválido.');

  const { rows: existentes } = await query('SELECT id, nombre FROM productos WHERE id = $1', [idNum]);
  if (!existentes[0]) throw new ApiError(404, 'Producto no encontrado.');

  const { rows: enUso } = await query(
    'SELECT 1 FROM detalle_cuenta WHERE producto_id = $1 LIMIT 1',
    [idNum]
  );
  if (enUso[0]) {
    throw new ApiError(
      409,
      `No se puede eliminar "${existentes[0].nombre}" porque ya tiene ventas registradas. ` +
        'Puedes desactivarlo para que deje de aparecer disponible, sin perder el historial.'
    );
  }

  await query('DELETE FROM productos WHERE id = $1', [idNum]);
  res.json({ ok: true, mensaje: `"${existentes[0].nombre}" eliminado del inventario.` });
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

module.exports = { listar, crear, actualizar, eliminar, bajoStock };
