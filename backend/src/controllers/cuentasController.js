const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * GET /api/cuentas?estado=ABIERTA
 * Lista cuentas (por defecto solo abiertas) con el nombre/referencia del cliente.
 * Es el listado que alimenta la pantalla "Cuentas abiertas" en tiempo real.
 */
const listar = asyncHandler(async (req, res) => {
  const estado = (req.query.estado || 'ABIERTA').toUpperCase();
  const { rows } = await query(
    `SELECT c.id, c.estado, c.total, c.fecha_apertura, c.fecha_cierre,
            c.metodo_pago, c.para_llevar,
            cl.id AS cliente_id, cl.referencia AS cliente_referencia,
            u.nombre_completo AS abierta_por
     FROM cuentas c
     JOIN clientes cl ON cl.id = c.cliente_id
     JOIN usuarios u ON u.id = c.usuario_apertura_id
     WHERE c.estado = $1::estado_cuenta
     ORDER BY c.fecha_apertura ASC`,
    [estado]
  );
  res.json({ ok: true, cuentas: rows });
});

/**
 * GET /api/cuentas/:id
 * Detalle completo de una cuenta: cliente, productos, cantidades, subtotales y total.
 */
const obtener = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows: cuentaRows } = await query(
    `SELECT c.id, c.estado, c.total, c.fecha_apertura, c.fecha_cierre, c.metodo_pago,
            c.para_llevar, c.observaciones,
            cl.id AS cliente_id, cl.referencia AS cliente_referencia,
            u.nombre_completo AS abierta_por
     FROM cuentas c
     JOIN clientes cl ON cl.id = c.cliente_id
     JOIN usuarios u ON u.id = c.usuario_apertura_id
     WHERE c.id = $1`,
    [id]
  );
  const cuenta = cuentaRows[0];
  if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada.');

  const { rows: detalle } = await query(
    `SELECT d.id, d.producto_id, p.nombre AS producto_nombre, p.tipo AS producto_tipo,
            d.cantidad, d.precio_unitario, d.subtotal
     FROM detalle_cuenta d
     JOIN productos p ON p.id = d.producto_id
     WHERE d.cuenta_id = $1
     ORDER BY d.creado_en ASC`,
    [id]
  );

  res.json({ ok: true, cuenta: { ...cuenta, detalle } });
});

/**
 * POST /api/cuentas
 * Abre una cuenta nueva. Si "clienteId" no viene pero sí "referencia",
 * crea el cliente ligero al vuelo (flujo típico: "abrir cuenta a 'casco negro'").
 */
const abrir = asyncHandler(async (req, res) => {
  const { clienteId, referencia, observaciones, paraLlevar } = req.body;

  if (!clienteId && !referencia) {
    throw new ApiError(400, 'Debes indicar clienteId o una referencia para crear el cliente.');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let clienteFinalId = clienteId;
    if (!clienteFinalId) {
      const { rows } = await client.query(
        `INSERT INTO clientes (referencia) VALUES ($1) RETURNING id`,
        [referencia.trim()]
      );
      clienteFinalId = rows[0].id;
    }

    const { rows: cuentaRows } = await client.query(
      `INSERT INTO cuentas (cliente_id, usuario_apertura_id, observaciones, para_llevar)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [clienteFinalId, req.usuario.id, observaciones || null, Boolean(paraLlevar)]
    );

    const cuentaId = cuentaRows[0].id;

    // Volvemos a consultar la cuenta recién creada, esta vez con el JOIN
    // a clientes/usuarios, para devolver la misma forma que "listar"/"obtener"
    // (incluye cliente_referencia). El INSERT ... RETURNING * por sí solo
    // no trae ese dato porque no hace join con la tabla clientes.
    const { rows: cuentaConCliente } = await client.query(
      `SELECT c.id, c.estado, c.total, c.fecha_apertura, c.fecha_cierre,
              c.metodo_pago, c.para_llevar,
              cl.id AS cliente_id, cl.referencia AS cliente_referencia,
              u.nombre_completo AS abierta_por
       FROM cuentas c
       JOIN clientes cl ON cl.id = c.cliente_id
       JOIN usuarios u ON u.id = c.usuario_apertura_id
       WHERE c.id = $1`,
      [cuentaId]
    );

    await client.query('COMMIT');
    res.status(201).json({ ok: true, cuenta: cuentaConCliente[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * POST /api/cuentas/:id/productos
 * Agrega un producto (o suma cantidad) a una cuenta abierta.
 * El precio unitario se congela al momento de agregarlo (precio histórico),
 * así cambios futuros de precio no alteran cuentas ya en curso.
 */
const agregarProducto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { productoId, cantidad } = req.body;

  const cantidadNum = Number(cantidad) || 1;
  if (cantidadNum <= 0) throw new ApiError(400, 'La cantidad debe ser mayor a 0.');

  const { rows: cuentaRows } = await query(
    'SELECT id, estado FROM cuentas WHERE id = $1', [id]
  );
  const cuenta = cuentaRows[0];
  if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada.');
  if (cuenta.estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

  const { rows: prodRows } = await query(
    'SELECT id, nombre, precio, stock, activo FROM productos WHERE id = $1', [productoId]
  );
  const producto = prodRows[0];
  if (!producto || !producto.activo) throw new ApiError(404, 'Producto no encontrado o inactivo.');
  if (producto.stock < cantidadNum) {
    throw new ApiError(409, `Stock insuficiente de "${producto.nombre}" (disponible: ${producto.stock}).`);
  }

  const { rows } = await query(
    `INSERT INTO detalle_cuenta (cuenta_id, producto_id, cantidad, precio_unitario)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, productoId, cantidadNum, producto.precio]
  );

  res.status(201).json({ ok: true, item: rows[0] });
});

/**
 * DELETE /api/cuentas/:id/productos/:itemId
 * Elimina un renglón del detalle de una cuenta abierta.
 */
const eliminarProducto = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;

  const { rows: cuentaRows } = await query('SELECT estado FROM cuentas WHERE id = $1', [id]);
  if (!cuentaRows[0]) throw new ApiError(404, 'Cuenta no encontrada.');
  if (cuentaRows[0].estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

  const { rowCount } = await query(
    'DELETE FROM detalle_cuenta WHERE id = $1 AND cuenta_id = $2', [itemId, id]
  );
  if (!rowCount) throw new ApiError(404, 'Renglón no encontrado en esta cuenta.');

  res.json({ ok: true, mensaje: 'Producto eliminado de la cuenta.' });
});

/**
 * PATCH /api/cuentas/:id/productos/:itemId
 * Cambia la cantidad de un renglón existente.
 */
const actualizarCantidad = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { cantidad } = req.body;
  const cantidadNum = Number(cantidad);
  if (!cantidadNum || cantidadNum <= 0) throw new ApiError(400, 'Cantidad inválida.');

  const { rows: cuentaRows } = await query('SELECT estado FROM cuentas WHERE id = $1', [id]);
  if (!cuentaRows[0]) throw new ApiError(404, 'Cuenta no encontrada.');
  if (cuentaRows[0].estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

  const { rows } = await query(
    `UPDATE detalle_cuenta SET cantidad = $1 WHERE id = $2 AND cuenta_id = $3 RETURNING *`,
    [cantidadNum, itemId, id]
  );
  if (!rows[0]) throw new ApiError(404, 'Renglón no encontrado en esta cuenta.');

  res.json({ ok: true, item: rows[0] });
});

/**
 * POST /api/cuentas/:id/cerrar
 * Cierra la cuenta: descuenta inventario de forma transaccional,
 * registra el pago (método) y marca la cuenta como CERRADA.
 * Si el stock no alcanza para algún producto, se revierte todo (ROLLBACK).
 */
const cerrar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { metodoPago } = req.body;

  const metodosValidos = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MIXTO'];
  if (!metodoPago || !metodosValidos.includes(metodoPago.toUpperCase())) {
    throw new ApiError(400, `metodoPago debe ser uno de: ${metodosValidos.join(', ')}`);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: cuentaRows } = await client.query(
      'SELECT * FROM cuentas WHERE id = $1 FOR UPDATE', [id]
    );
    const cuenta = cuentaRows[0];
    if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada.');
    if (cuenta.estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

    const { rows: detalle } = await client.query(
      'SELECT producto_id, cantidad FROM detalle_cuenta WHERE cuenta_id = $1', [id]
    );

    if (detalle.length === 0) {
      throw new ApiError(400, 'No se puede cerrar una cuenta sin productos agregados.');
    }

    // Descontar stock producto por producto, validando disponibilidad real.
    for (const item of detalle) {
      const { rows: prodRows } = await client.query(
        'SELECT id, nombre, stock FROM productos WHERE id = $1 FOR UPDATE', [item.producto_id]
      );
      const producto = prodRows[0];
      if (producto.stock < item.cantidad) {
        throw new ApiError(409, `Stock insuficiente de "${producto.nombre}" para cerrar la cuenta.`);
      }
      await client.query(
        'UPDATE productos SET stock = stock - $1 WHERE id = $2',
        [item.cantidad, item.producto_id]
      );
    }

    const { rows: cerrada } = await client.query(
      `UPDATE cuentas SET
          estado = 'CERRADA',
          metodo_pago = $1::metodo_pago,
          usuario_cierre_id = $2,
          fecha_cierre = NOW()
       WHERE id = $3
       RETURNING *`,
      [metodoPago.toUpperCase(), req.usuario.id, id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, cuenta: cerrada[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/cuentas/:id
 * Edita datos generales de una cuenta abierta: si es "para llevar" y/o observaciones.
 * No permite editar cuentas ya cerradas.
 */
const actualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paraLlevar, observaciones } = req.body;

  const { rows: cuentaRows } = await query('SELECT estado FROM cuentas WHERE id = $1', [id]);
  if (!cuentaRows[0]) throw new ApiError(404, 'Cuenta no encontrada.');
  if (cuentaRows[0].estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

  const { rows } = await query(
    `UPDATE cuentas SET
        para_llevar = COALESCE($1, para_llevar),
        observaciones = COALESCE($2, observaciones)
     WHERE id = $3
     RETURNING *`,
    [typeof paraLlevar === 'boolean' ? paraLlevar : null, observaciones, id]
  );

  res.json({ ok: true, cuenta: rows[0] });
});

module.exports = {
  listar,
  obtener,
  abrir,
  actualizar,
  agregarProducto,
  eliminarProducto,
  actualizarCantidad,
  cerrar,
};
