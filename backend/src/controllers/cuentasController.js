const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

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

const obtener = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows: cuentaRows } = await query(
    `SELECT c.id, c.estado, c.total, c.fecha_apertura, c.fecha_cierre, c.metodo_pago,
            c.para_llevar, c.observaciones, c.caja_turno_id,
            c.monto_efectivo, c.monto_transferencia,
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

const agregarProducto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { productoId, cantidad } = req.body;
  const cantidadNum = Number(cantidad) || 1;
  if (cantidadNum <= 0) throw new ApiError(400, 'La cantidad debe ser mayor a 0.');

  const { rows: cuentaRows } = await query('SELECT id, estado FROM cuentas WHERE id = $1', [id]);
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

const actualizarCantidad = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const cantidadNum = Number(req.body.cantidad);
  if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
    throw new ApiError(400, 'Cantidad inválida.');
  }

  const { rows: cuentaRows } = await query('SELECT estado FROM cuentas WHERE id = $1', [id]);
  if (!cuentaRows[0]) throw new ApiError(404, 'Cuenta no encontrada.');
  if (cuentaRows[0].estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

  const { rows: itemRows } = await query(
    `SELECT d.id, d.producto_id, p.nombre, p.stock
     FROM detalle_cuenta d
     JOIN productos p ON p.id = d.producto_id
     WHERE d.id = $1 AND d.cuenta_id = $2`,
    [itemId, id]
  );
  const item = itemRows[0];
  if (!item) throw new ApiError(404, 'Renglón no encontrado en esta cuenta.');
  if (cantidadNum > item.stock) {
    throw new ApiError(409, `Stock insuficiente de "${item.nombre}" (disponible: ${item.stock}).`);
  }

  const { rows } = await query(
    `UPDATE detalle_cuenta SET cantidad = $1 WHERE id = $2 AND cuenta_id = $3 RETURNING *`,
    [cantidadNum, itemId, id]
  );
  res.json({ ok: true, item: rows[0] });
});

const cerrar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const metodoPago = String(req.body.metodoPago || '').toUpperCase();
  const montoEfectivo = req.body.montoEfectivo === undefined ? null : Number(req.body.montoEfectivo);
  const montoTransferencia = req.body.montoTransferencia === undefined ? null : Number(req.body.montoTransferencia);
  const metodosValidos = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MIXTO'];

  if (!metodosValidos.includes(metodoPago)) {
    throw new ApiError(400, `metodoPago debe ser uno de: ${metodosValidos.join(', ')}`);
  }

  if (metodoPago === 'MIXTO') {
    if (!Number.isFinite(montoEfectivo) || !Number.isFinite(montoTransferencia) || montoEfectivo < 0 || montoTransferencia < 0) {
      throw new ApiError(400, 'Para un pago mixto debes indicar efectivo y transferencia válidos.');
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: turnoRows } = await client.query(
      `SELECT id FROM caja_turnos WHERE fecha_cierre IS NULL LIMIT 1 FOR UPDATE`
    );
    const turno = turnoRows[0];
    if (!turno) throw new ApiError(409, 'No hay una caja abierta. Debes abrir la caja antes de registrar pagos.');

    const { rows: cuentaRows } = await client.query(
      'SELECT * FROM cuentas WHERE id = $1 FOR UPDATE', [id]
    );
    const cuenta = cuentaRows[0];
    if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada.');
    if (cuenta.estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

    if (metodoPago === 'MIXTO') {
      const totalCuenta = Number(cuenta.total);
      const sumaMixta = montoEfectivo + montoTransferencia;
      if (Math.abs(sumaMixta - totalCuenta) > 0.01) {
        throw new ApiError(400, `El pago mixto debe sumar exactamente ${totalCuenta}.`);
      }
    }

    const { rows: detalle } = await client.query(
      'SELECT producto_id, cantidad FROM detalle_cuenta WHERE cuenta_id = $1', [id]
    );
    if (detalle.length === 0) throw new ApiError(400, 'No se puede cerrar una cuenta sin productos agregados.');

    for (const item of detalle) {
      const { rows: prodRows } = await client.query(
        'SELECT id, nombre, stock FROM productos WHERE id = $1 FOR UPDATE', [item.producto_id]
      );
      const producto = prodRows[0];
      if (!producto) throw new ApiError(404, 'Uno de los productos de la cuenta ya no existe.');
      if (producto.stock < item.cantidad) {
        throw new ApiError(409, `Stock insuficiente de "${producto.nombre}" para cerrar la cuenta.`);
      }
      await client.query('UPDATE productos SET stock = stock - $1 WHERE id = $2', [item.cantidad, item.producto_id]);
    }

    const efectivoFinal = metodoPago === 'EFECTIVO' ? cuenta.total : metodoPago === 'MIXTO' ? montoEfectivo : null;
    const transferenciaFinal = metodoPago === 'TRANSFERENCIA' ? cuenta.total : metodoPago === 'MIXTO' ? montoTransferencia : null;

    const { rows: cerrada } = await client.query(
      `UPDATE cuentas SET
          estado = 'CERRADA',
          metodo_pago = $1::metodo_pago,
          monto_efectivo = $2,
          monto_transferencia = $3,
          usuario_cierre_id = $4,
          caja_turno_id = $5,
          fecha_cierre = NOW()
       WHERE id = $6
       RETURNING *`,
      [metodoPago, efectivoFinal, transferenciaFinal, req.usuario.id, turno.id, id]
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
