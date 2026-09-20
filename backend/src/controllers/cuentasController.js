// backend/src/controllers/cuentasController.js
// Versión multi-tenant. Regla de oro igual que en productosController:
// req.negocioId siempre en el WHERE, nunca confiado desde el body/params.
//
// Puntos delicados de este archivo (léelos antes de tocar algo):
// - El turno de caja se busca con negocio_id: cada negocio tiene su propia
//   caja abierta, no comparten una sola.
// - El "stock reservado por otras cuentas abiertas" se calcula uniendo
//   detalle_cuenta -> cuentas y filtrando cuentas.negocio_id, para no mezclar
//   reservas de dos negocios distintos aunque (en teoría) nunca compartirían
//   producto_id, porque cada producto ya pertenece a un solo negocio.
// - detalle_cuenta NO tiene negocio_id propio: su aislamiento depende de que
//   cuenta_id y producto_id ya hayan sido validados contra negocio_id antes.

const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const listar = asyncHandler(async (req, res) => {
  const estado = (req.query.estado || 'ABIERTA').toUpperCase();
  if (!['ABIERTA', 'CERRADA', 'CANCELADA'].includes(estado)) throw new ApiError(400, 'Estado de cuenta inválido.');

  const { rows } = await query(
    `SELECT c.id, c.estado, c.total, c.fecha_apertura, c.fecha_cierre,
            c.metodo_pago, c.para_llevar,
            cl.id AS cliente_id, cl.referencia AS cliente_referencia,
            u.nombre_completo AS abierta_por
     FROM cuentas c
     JOIN clientes cl ON cl.id = c.cliente_id
     JOIN usuarios u ON u.id = c.usuario_apertura_id
     WHERE c.negocio_id = $1 AND c.estado = $2::estado_cuenta
     ORDER BY c.fecha_apertura ASC`,
    [req.negocioId, estado]
  );
  res.json({ ok: true, cuentas: rows });
});

const obtener = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'ID de cuenta inválido.');

  const { rows: cuentaRows } = await query(
    `SELECT c.id, c.estado, c.total, c.fecha_apertura, c.fecha_cierre, c.metodo_pago,
            c.para_llevar, c.observaciones, c.caja_turno_id,
            c.monto_efectivo, c.monto_transferencia,
            cl.id AS cliente_id, cl.referencia AS cliente_referencia,
            u.nombre_completo AS abierta_por
     FROM cuentas c
     JOIN clientes cl ON cl.id = c.cliente_id
     JOIN usuarios u ON u.id = c.usuario_apertura_id
     WHERE c.id = $1 AND c.negocio_id = $2`,
    [id, req.negocioId]
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
  const clienteId = req.body.clienteId ? Number(req.body.clienteId) : null;
  const referencia = String(req.body.referencia || '').trim();
  const observaciones = req.body.observaciones ? String(req.body.observaciones).trim() : null;
  const paraLlevar = Boolean(req.body.paraLlevar);

  if (clienteId !== null && (!Number.isInteger(clienteId) || clienteId <= 0)) {
    throw new ApiError(400, 'Cliente inválido.');
  }
  if (!clienteId && !referencia) throw new ApiError(400, 'Debes indicar una referencia para el cliente.');
  if (referencia.length > 100) throw new ApiError(400, 'La referencia no puede superar 100 caracteres.');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    let clienteFinalId = clienteId;

    if (!clienteFinalId) {
      const { rows: existentes } = await client.query(
        `SELECT id FROM clientes WHERE negocio_id = $1 AND LOWER(referencia) = LOWER($2) ORDER BY id ASC LIMIT 1`,
        [req.negocioId, referencia]
      );
      if (existentes[0]) {
        clienteFinalId = existentes[0].id;
      } else {
        const { rows } = await client.query(
          `INSERT INTO clientes (negocio_id, referencia) VALUES ($1, $2) RETURNING id`,
          [req.negocioId, referencia]
        );
        clienteFinalId = rows[0].id;
      }
    } else {
      const { rows } = await client.query(
        'SELECT id FROM clientes WHERE id = $1 AND negocio_id = $2',
        [clienteFinalId, req.negocioId]
      );
      if (!rows[0]) throw new ApiError(404, 'Cliente no encontrado.');
    }

    const { rows: cuentaRows } = await client.query(
      `INSERT INTO cuentas (negocio_id, cliente_id, usuario_apertura_id, observaciones, para_llevar)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.negocioId, clienteFinalId, req.usuario.id, observaciones || null, paraLlevar]
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
       WHERE c.id = $1 AND c.negocio_id = $2`,
      [cuentaId, req.negocioId]
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
  const cuentaId = Number(req.params.id);
  const productoId = Number(req.body.productoId);
  const cantidadNum = Number(req.body.cantidad);

  if (!Number.isInteger(cuentaId) || cuentaId <= 0) throw new ApiError(400, 'ID de cuenta inválido.');
  if (!Number.isInteger(productoId) || productoId <= 0) throw new ApiError(400, 'Producto inválido.');
  if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) throw new ApiError(400, 'La cantidad debe ser un entero mayor a 0.');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: cuentaRows } = await client.query(
      'SELECT id, estado FROM cuentas WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [cuentaId, req.negocioId]
    );
    const cuenta = cuentaRows[0];
    if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada.');
    if (cuenta.estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

    const { rows: prodRows } = await client.query(
      'SELECT id, nombre, precio, stock, activo FROM productos WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [productoId, req.negocioId]
    );
    const producto = prodRows[0];
    if (!producto || !producto.activo) throw new ApiError(404, 'Producto no encontrado o inactivo.');

    const { rows: reservaRows } = await client.query(
      `SELECT COALESCE(SUM(d.cantidad), 0)::int AS reservado
       FROM detalle_cuenta d
       JOIN cuentas c ON c.id = d.cuenta_id
       WHERE d.producto_id = $1 AND c.negocio_id = $2 AND c.estado = 'ABIERTA' AND c.id <> $3`,
      [productoId, req.negocioId, cuentaId]
    );
    const reservadoOtros = Number(reservaRows[0].reservado);

    const { rows: existenteRows } = await client.query(
      'SELECT id, cantidad FROM detalle_cuenta WHERE cuenta_id = $1 AND producto_id = $2 LIMIT 1 FOR UPDATE',
      [cuentaId, productoId]
    );
    const existente = existenteRows[0];
    const nuevaCantidad = (existente ? Number(existente.cantidad) : 0) + cantidadNum;

    if (reservadoOtros + nuevaCantidad > Number(producto.stock)) {
      const disponible = Math.max(0, Number(producto.stock) - reservadoOtros - (existente ? Number(existente.cantidad) : 0));
      throw new ApiError(409, `Stock insuficiente de "${producto.nombre}" (disponible para esta cuenta: ${disponible}).`);
    }

    let item;
    if (existente) {
      const { rows } = await client.query(
        'UPDATE detalle_cuenta SET cantidad = $1 WHERE id = $2 RETURNING *',
        [nuevaCantidad, existente.id]
      );
      item = rows[0];
    } else {
      const { rows } = await client.query(
        `INSERT INTO detalle_cuenta (cuenta_id, producto_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [cuentaId, productoId, cantidadNum, producto.precio]
      );
      item = rows[0];
    }

    await client.query('COMMIT');
    res.status(existente ? 200 : 201).json({ ok: true, item });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const eliminarProducto = asyncHandler(async (req, res) => {
  const cuentaId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(cuentaId) || !Number.isInteger(itemId)) throw new ApiError(400, 'Identificador inválido.');

  const { rows: cuentaRows } = await query(
    'SELECT estado FROM cuentas WHERE id = $1 AND negocio_id = $2',
    [cuentaId, req.negocioId]
  );
  if (!cuentaRows[0]) throw new ApiError(404, 'Cuenta no encontrada.');
  if (cuentaRows[0].estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

  const { rowCount } = await query('DELETE FROM detalle_cuenta WHERE id = $1 AND cuenta_id = $2', [itemId, cuentaId]);
  if (!rowCount) throw new ApiError(404, 'Renglón no encontrado en esta cuenta.');
  res.json({ ok: true, mensaje: 'Producto eliminado de la cuenta.' });
});

const actualizarCantidad = asyncHandler(async (req, res) => {
  const cuentaId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const cantidadNum = Number(req.body.cantidad);
  if (!Number.isInteger(cuentaId) || !Number.isInteger(itemId)) throw new ApiError(400, 'Identificador inválido.');
  if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) throw new ApiError(400, 'Cantidad inválida.');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: cuentaRows } = await client.query(
      'SELECT estado FROM cuentas WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [cuentaId, req.negocioId]
    );
    if (!cuentaRows[0]) throw new ApiError(404, 'Cuenta no encontrada.');
    if (cuentaRows[0].estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

    const { rows: itemRows } = await client.query(
      `SELECT d.id, d.producto_id, d.cantidad AS cantidad_actual, p.nombre, p.stock
       FROM detalle_cuenta d JOIN productos p ON p.id = d.producto_id
       WHERE d.id = $1 AND d.cuenta_id = $2 FOR UPDATE`,
      [itemId, cuentaId]
    );
    const item = itemRows[0];
    if (!item) throw new ApiError(404, 'Renglón no encontrado en esta cuenta.');

    const { rows: reservaRows } = await client.query(
      `SELECT COALESCE(SUM(d.cantidad), 0)::int AS reservado
       FROM detalle_cuenta d JOIN cuentas c ON c.id = d.cuenta_id
       WHERE d.producto_id = $1 AND c.negocio_id = $2 AND c.estado = 'ABIERTA' AND c.id <> $3`,
      [item.producto_id, req.negocioId, cuentaId]
    );
    const reservadoOtros = Number(reservaRows[0].reservado);
    if (reservadoOtros + cantidadNum > Number(item.stock)) {
      const disponible = Math.max(0, Number(item.stock) - reservadoOtros);
      throw new ApiError(409, `Stock insuficiente de "${item.nombre}" (máximo disponible para esta cuenta: ${disponible}).`);
    }

    const { rows } = await client.query(
      'UPDATE detalle_cuenta SET cantidad = $1 WHERE id = $2 AND cuenta_id = $3 RETURNING *',
      [cantidadNum, itemId, cuentaId]
    );
    await client.query('COMMIT');
    res.json({ ok: true, item: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const cerrar = asyncHandler(async (req, res) => {
  const cuentaId = Number(req.params.id);
  const metodoPago = String(req.body.metodoPago || '').toUpperCase();
  const montoEfectivo = req.body.montoEfectivo === undefined ? null : Number(req.body.montoEfectivo);
  const montoTransferencia = req.body.montoTransferencia === undefined ? null : Number(req.body.montoTransferencia);
  const metodosValidos = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MIXTO'];

  if (!Number.isInteger(cuentaId) || cuentaId <= 0) throw new ApiError(400, 'ID de cuenta inválido.');
  if (!metodosValidos.includes(metodoPago)) throw new ApiError(400, `metodoPago debe ser uno de: ${metodosValidos.join(', ')}`);
  if (metodoPago === 'MIXTO' && (!Number.isFinite(montoEfectivo) || !Number.isFinite(montoTransferencia) || montoEfectivo < 0 || montoTransferencia < 0)) {
    throw new ApiError(400, 'Para un pago mixto debes indicar efectivo y transferencia válidos.');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Una sola caja abierta POR NEGOCIO (ver migración 005: el índice único
    // ahora es (negocio_id) WHERE fecha_cierre IS NULL, ya no global).
    const { rows: turnoRows } = await client.query(
      `SELECT id FROM caja_turnos WHERE negocio_id = $1 AND fecha_cierre IS NULL LIMIT 1 FOR UPDATE`,
      [req.negocioId]
    );
    const turno = turnoRows[0];
    if (!turno) throw new ApiError(409, 'No hay una caja abierta. Debes abrir la caja antes de registrar pagos.');

    const { rows: cuentaRows } = await client.query(
      'SELECT * FROM cuentas WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [cuentaId, req.negocioId]
    );
    const cuenta = cuentaRows[0];
    if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada.');
    if (cuenta.estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

    const detalleRows = await client.query('SELECT producto_id, cantidad FROM detalle_cuenta WHERE cuenta_id = $1', [cuentaId]);
    const detalle = detalleRows.rows;
    if (detalle.length === 0) throw new ApiError(400, 'No se puede cerrar una cuenta sin productos agregados.');

    if (metodoPago === 'MIXTO') {
      const sumaMixta = montoEfectivo + montoTransferencia;
      if (Math.abs(sumaMixta - Number(cuenta.total)) > 0.01) {
        throw new ApiError(400, `El pago mixto debe sumar exactamente ${Number(cuenta.total)}.`);
      }
    }

    for (const item of detalle) {
      const { rows: prodRows } = await client.query(
        'SELECT id, nombre, stock FROM productos WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
        [item.producto_id, req.negocioId]
      );
      const producto = prodRows[0];
      if (!producto) throw new ApiError(404, 'Uno de los productos de la cuenta ya no existe.');
      if (Number(producto.stock) < Number(item.cantidad)) throw new ApiError(409, `Stock insuficiente de "${producto.nombre}" para cerrar la cuenta.`);
      await client.query('UPDATE productos SET stock = stock - $1 WHERE id = $2', [item.cantidad, item.producto_id]);
    }

    const efectivoFinal = metodoPago === 'EFECTIVO' ? Number(cuenta.total) : metodoPago === 'MIXTO' ? montoEfectivo : null;
    const transferenciaFinal = metodoPago === 'TRANSFERENCIA' ? Number(cuenta.total) : metodoPago === 'MIXTO' ? montoTransferencia : null;

    const { rows: cerrada } = await client.query(
      `UPDATE cuentas SET
          estado = 'CERRADA', metodo_pago = $1::metodo_pago,
          monto_efectivo = $2, monto_transferencia = $3,
          usuario_cierre_id = $4, caja_turno_id = $5, fecha_cierre = NOW()
       WHERE id = $6 AND negocio_id = $7 RETURNING *`,
      [metodoPago, efectivoFinal, transferenciaFinal, req.usuario.id, turno.id, cuentaId, req.negocioId]
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

const cancelar = asyncHandler(async (req, res) => {
  const cuentaId = Number(req.params.id);
  if (!Number.isInteger(cuentaId) || cuentaId <= 0) throw new ApiError(400, 'ID de cuenta inválido.');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: cuentaRows } = await client.query(
      'SELECT id, estado, total FROM cuentas WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [cuentaId, req.negocioId]
    );
    const cuenta = cuentaRows[0];

    if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada.');
    if (cuenta.estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya no está abierta.');
    if (Number(cuenta.total) !== 0) throw new ApiError(400, 'Solo se puede cancelar una cuenta que no tenga productos.');

    const { rows: detalleRows } = await client.query(
      'SELECT id FROM detalle_cuenta WHERE cuenta_id = $1 LIMIT 1',
      [cuentaId]
    );
    if (detalleRows[0]) throw new ApiError(400, 'Solo se puede cancelar una cuenta que no tenga productos.');

    const { rows: cancelada } = await client.query(
      `UPDATE cuentas
       SET estado = 'CANCELADA', fecha_cierre = NOW(), usuario_cierre_id = $1
       WHERE id = $2 AND negocio_id = $3
       RETURNING *`,
      [req.usuario.id, cuentaId, req.negocioId]
    );

    await client.query('COMMIT');
    res.json({ ok: true, cuenta: cancelada[0], mensaje: 'Cuenta cancelada. No se registró ninguna venta.' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const actualizar = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'ID de cuenta inválido.');
  const { paraLlevar, observaciones } = req.body;
  const { rows: cuentaRows } = await query(
    'SELECT estado FROM cuentas WHERE id = $1 AND negocio_id = $2',
    [id, req.negocioId]
  );
  if (!cuentaRows[0]) throw new ApiError(404, 'Cuenta no encontrada.');
  if (cuentaRows[0].estado !== 'ABIERTA') throw new ApiError(409, 'La cuenta ya está cerrada.');

  const paraLlevarFinal = typeof paraLlevar === 'boolean' ? paraLlevar : null;
  const observacionesFinal = observaciones === undefined ? null : String(observaciones).trim();
  const { rows } = await query(
    `UPDATE cuentas SET
       para_llevar = COALESCE($1, para_llevar),
       observaciones = CASE WHEN $2::text IS NULL THEN observaciones ELSE NULLIF($2::text, '') END
     WHERE id = $3 AND negocio_id = $4 RETURNING *`,
    [paraLlevarFinal, observacionesFinal, id, req.negocioId]
  );
  res.json({ ok: true, cuenta: rows[0] });
});

module.exports = { listar, obtener, abrir, actualizar, agregarProducto, eliminarProducto, actualizarCantidad, cerrar, cancelar };
