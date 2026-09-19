// backend/src/routes/cajaroutes.js
// Versión multi-tenant. El cambio clave: antes había "una sola caja abierta
// en todo el sistema" (índice único global). Ahora es una caja abierta POR
// NEGOCIO — así el negocio B puede tener su caja abierta mientras el A tiene
// la suya cerrada, sin pisarse.

const { Router } = require('express');
const { query, getClient } = require('../config/db');
const { autenticar, autorizar } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = Router();
router.use(autenticar);

const resumenPagosSQL = `
  SELECT COUNT(*)::int AS ventas,
         COALESCE(SUM(total), 0) AS total,
         COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN total WHEN metodo_pago = 'MIXTO' THEN COALESCE(monto_efectivo, 0) ELSE 0 END), 0) AS efectivo,
         COALESCE(SUM(CASE WHEN metodo_pago = 'TRANSFERENCIA' THEN total WHEN metodo_pago = 'MIXTO' THEN COALESCE(monto_transferencia, 0) ELSE 0 END), 0) AS transferencia,
         COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'TARJETA'), 0) AS tarjeta,
         COALESCE(SUM(total) FILTER (WHERE metodo_pago = 'MIXTO'), 0) AS mixto
  FROM cuentas
  WHERE negocio_id = $2 AND estado = 'CERRADA' AND caja_turno_id = $1`;

const actual = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ct.id,
            ct.monto_apertura,
            ct.fecha_apertura,
            ct.usuario_apertura_id,
            u.nombre_completo AS abierta_por,
            COALESCE(SUM(c.total), 0) AS total_ventas,
            COUNT(c.id)::int AS ventas_realizadas,
            COALESCE(SUM(CASE WHEN c.metodo_pago = 'EFECTIVO' THEN c.total WHEN c.metodo_pago = 'MIXTO' THEN COALESCE(c.monto_efectivo, 0) ELSE 0 END), 0) AS total_efectivo,
            COALESCE(SUM(CASE WHEN c.metodo_pago = 'TRANSFERENCIA' THEN c.total WHEN c.metodo_pago = 'MIXTO' THEN COALESCE(c.monto_transferencia, 0) ELSE 0 END), 0) AS total_transferencia,
            COALESCE(SUM(c.total) FILTER (WHERE c.metodo_pago = 'TARJETA'), 0) AS total_tarjeta,
            COALESCE(SUM(c.total) FILTER (WHERE c.metodo_pago = 'MIXTO'), 0) AS total_mixto
     FROM caja_turnos ct
     JOIN usuarios u ON u.id = ct.usuario_apertura_id
     LEFT JOIN cuentas c ON c.caja_turno_id = ct.id AND c.estado = 'CERRADA'
     WHERE ct.negocio_id = $1 AND ct.fecha_cierre IS NULL
     GROUP BY ct.id, u.nombre_completo
     LIMIT 1`,
    [req.negocioId]
  );

  const turno = rows[0] || null;
  if (turno) turno.monto_esperado = Number(turno.monto_apertura) + Number(turno.total_efectivo);
  res.json({ ok: true, turno });
});

const abrir = asyncHandler(async (req, res) => {
  const montoApertura = Number(req.body.monto_apertura);
  if (!Number.isFinite(montoApertura) || montoApertura < 0) throw new ApiError(400, 'El monto de apertura no es válido.');

  try {
    const { rows } = await query(
      `INSERT INTO caja_turnos (negocio_id, usuario_apertura_id, monto_apertura) VALUES ($1, $2, $3) RETURNING *`,
      [req.negocioId, req.usuario.id, montoApertura]
    );
    res.status(201).json({ ok: true, turno: rows[0] });
  } catch (err) {
    if (err.code === '23505') throw new ApiError(409, 'Ya existe una caja abierta para este negocio.');
    throw err;
  }
});

const cerrar = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const montoContado = Number(req.body.monto_contado);
  const observaciones = req.body.observaciones ? String(req.body.observaciones).trim() : null;

  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'ID de turno inválido.');
  if (!Number.isFinite(montoContado) || montoContado < 0) throw new ApiError(400, 'El efectivo contado no es válido.');
  if (observaciones && observaciones.length > 500) throw new ApiError(400, 'Las observaciones no pueden superar 500 caracteres.');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: turnoRows } = await client.query(
      `SELECT * FROM caja_turnos WHERE id = $1 AND negocio_id = $2 AND fecha_cierre IS NULL FOR UPDATE`,
      [id, req.negocioId]
    );
    const turno = turnoRows[0];
    if (!turno) throw new ApiError(404, 'Turno de caja abierto no encontrado.');

    const { rows: abiertas } = await client.query(
      `SELECT COUNT(*)::int AS total FROM cuentas WHERE negocio_id = $1 AND estado = 'ABIERTA'`,
      [req.negocioId]
    );
    if (Number(abiertas[0].total) > 0) {
      throw new ApiError(409, `No puedes cerrar la caja mientras haya ${abiertas[0].total} cuenta(s) abierta(s). Cierra o cobra esas cuentas primero.`);
    }

    const { rows: resumenRows } = await client.query(resumenPagosSQL, [turno.id, req.negocioId]);
    const resumen = resumenRows[0];
    const totalVentas = Number(resumen.total);
    const totalEfectivo = Number(resumen.efectivo);
    const montoEsperado = Number(turno.monto_apertura) + totalEfectivo;
    const diferencia = montoContado - montoEsperado;

    const { rows: cerradaRows } = await client.query(
      `UPDATE caja_turnos SET
          usuario_cierre_id = $1,
          monto_esperado = $2,
          monto_contado = $3,
          diferencia = $4,
          total_ventas = $5,
          ventas_realizadas = $6,
          total_efectivo = $7,
          total_transferencia = $8,
          total_tarjeta = $9,
          total_mixto = $10,
          fecha_cierre = NOW(),
          observaciones = $11
       WHERE id = $12 AND negocio_id = $13
       RETURNING *`,
      [
        req.usuario.id,
        montoEsperado,
        montoContado,
        diferencia,
        totalVentas,
        Number(resumen.ventas),
        totalEfectivo,
        Number(resumen.transferencia),
        Number(resumen.tarjeta),
        Number(resumen.mixto),
        observaciones,
        id,
        req.negocioId,
      ]
    );

    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Caja cerrada correctamente.', turno: cerradaRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const historial = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ct.*, ua.nombre_completo AS abierta_por, uc.nombre_completo AS cerrada_por
     FROM caja_turnos ct
     JOIN usuarios ua ON ua.id = ct.usuario_apertura_id
     LEFT JOIN usuarios uc ON uc.id = ct.usuario_cierre_id
     WHERE ct.negocio_id = $1
     ORDER BY ct.fecha_apertura DESC LIMIT 100`,
    [req.negocioId]
  );
  res.json({ ok: true, historial: rows });
});

router.get('/actual', actual);
router.post('/abrir', autorizar('ADMIN'), abrir);
router.post('/:id/cerrar', autorizar('ADMIN'), cerrar);
router.get('/historial', autorizar('ADMIN'), historial);

module.exports = router;
