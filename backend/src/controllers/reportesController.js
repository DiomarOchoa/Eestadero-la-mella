// backend/src/controllers/reportesController.js
// Versión multi-tenant: cada consulta filtra por negocio_id, así que los
// reportes de un negocio nunca mezclan ventas de otro.

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const obtenerDias = (valor) => {
  const dias = Number(valor);
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
    throw new ApiError(400, 'El rango de días debe estar entre 1 y 365.');
  }
  return dias;
};

const obtenerLimite = (valor) => {
  const limite = Number(valor);
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
    throw new ApiError(400, 'El límite debe estar entre 1 y 100.');
  }
  return limite;
};

const ventasPorDia = asyncHandler(async (req, res) => {
  const dias = obtenerDias(req.query.dias || 30);
  const { rows } = await query(
    `SELECT (fecha_cierre AT TIME ZONE 'America/Bogota')::date AS fecha,
            COUNT(*)::int AS cuentas_cerradas,
            COALESCE(SUM(total), 0) AS total_vendido
     FROM cuentas
     WHERE negocio_id = $1
       AND estado = 'CERRADA'
       AND fecha_cierre >= NOW() - ($2 || ' days')::INTERVAL
     GROUP BY (fecha_cierre AT TIME ZONE 'America/Bogota')::date
     ORDER BY fecha ASC`,
    [req.negocioId, dias]
  );
  res.json({ ok: true, ventasPorDia: rows });
});

const productosMasVendidos = asyncHandler(async (req, res) => {
  const limite = obtenerLimite(req.query.limite || 10);
  const { rows } = await query(
    `SELECT p.id, p.nombre, p.tipo,
            SUM(d.cantidad) AS unidades_vendidas,
            SUM(d.subtotal) AS total_generado
     FROM detalle_cuenta d
     JOIN productos p ON p.id = d.producto_id
     JOIN cuentas c ON c.id = d.cuenta_id
     WHERE c.negocio_id = $1 AND c.estado = 'CERRADA'
     GROUP BY p.id, p.nombre, p.tipo
     ORDER BY unidades_vendidas DESC, p.nombre ASC
     LIMIT $2`,
    [req.negocioId, limite]
  );
  res.json({ ok: true, productosMasVendidos: rows });
});

const resumen = asyncHandler(async (req, res) => {
  const [{ rows: abiertas }, { rows: hoy }, { rows: bajoStock }] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM cuentas WHERE negocio_id = $1 AND estado = 'ABIERTA'`, [req.negocioId]),
    query(
      `SELECT COALESCE(SUM(total), 0) AS total_hoy, COUNT(*)::int AS cuentas_hoy
       FROM cuentas
       WHERE negocio_id = $1 AND estado = 'CERRADA'
         AND (fecha_cierre AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date`,
      [req.negocioId]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM productos WHERE negocio_id = $1 AND activo = TRUE AND stock <= stock_minimo`,
      [req.negocioId]
    ),
  ]);

  res.json({
    ok: true,
    resumen: {
      cuentasAbiertas: abiertas[0].total,
      totalVendidoHoy: hoy[0].total_hoy,
      cuentasCerradasHoy: hoy[0].cuentas_hoy,
      productosBajoStock: bajoStock[0].total,
    },
  });
});

const cuentasDetalle = asyncHandler(async (req, res) => {
  const dias = obtenerDias(req.query.dias || 30);
  const { rows } = await query(
    `SELECT c.id,
            cl.referencia AS cliente,
            c.total,
            c.metodo_pago,
            c.monto_efectivo,
            c.monto_transferencia,
            c.para_llevar,
            c.fecha_apertura,
            c.fecha_cierre,
            u.nombre_completo AS atendido_por,
            COALESCE(
              (SELECT json_agg(
                        json_build_object(
                          'producto', p.nombre,
                          'cantidad', d.cantidad,
                          'precio_unitario', d.precio_unitario,
                          'subtotal', d.subtotal
                        ) ORDER BY p.nombre
                      )
               FROM detalle_cuenta d
               JOIN productos p ON p.id = d.producto_id
               WHERE d.cuenta_id = c.id
              ), '[]'::json
            ) AS productos
     FROM cuentas c
     JOIN clientes cl ON cl.id = c.cliente_id
     LEFT JOIN usuarios u ON u.id = c.usuario_cierre_id
     WHERE c.negocio_id = $1
       AND c.estado = 'CERRADA'
       AND c.fecha_cierre >= NOW() - ($2 || ' days')::INTERVAL
     ORDER BY c.fecha_cierre DESC`,
    [req.negocioId, dias]
  );
  res.json({ ok: true, cuentasDetalle: rows });
});

const cierreCaja = asyncHandler(async (req, res) => {
  const fecha = req.query.fecha || null;
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new ApiError(400, 'La fecha debe tener el formato YYYY-MM-DD.');
  }

  const { rows } = await query(
    `SELECT u.id AS usuario_id,
            u.nombre_completo AS usuario,
            COUNT(*)::int AS cuentas_cerradas,
            COALESCE(SUM(c.total), 0) AS total_vendido,
            COALESCE(SUM(CASE
              WHEN c.metodo_pago = 'EFECTIVO' THEN c.total
              WHEN c.metodo_pago = 'MIXTO' THEN COALESCE(c.monto_efectivo, 0)
              ELSE 0 END), 0) AS total_efectivo,
            COALESCE(SUM(CASE
              WHEN c.metodo_pago = 'TRANSFERENCIA' THEN c.total
              WHEN c.metodo_pago = 'MIXTO' THEN COALESCE(c.monto_transferencia, 0)
              ELSE 0 END), 0) AS total_transferencia,
            COALESCE(SUM(c.total) FILTER (WHERE c.metodo_pago = 'TARJETA'), 0) AS total_tarjeta,
            COALESCE(SUM(c.total) FILTER (WHERE c.metodo_pago = 'MIXTO'), 0) AS total_mixto
     FROM cuentas c
     JOIN usuarios u ON u.id = c.usuario_cierre_id
     WHERE c.negocio_id = $1
       AND c.estado = 'CERRADA'
       AND (c.fecha_cierre AT TIME ZONE 'America/Bogota')::date = COALESCE($2::date, (NOW() AT TIME ZONE 'America/Bogota')::date)
     GROUP BY u.id, u.nombre_completo
     ORDER BY total_vendido DESC, u.nombre_completo ASC`,
    [req.negocioId, fecha]
  );

  const totalGeneral = rows.reduce((acc, r) => acc + Number(r.total_vendido), 0);
  const cuentasGeneral = rows.reduce((acc, r) => acc + Number(r.cuentas_cerradas), 0);
  const fechaActualBogota = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

  res.json({
    ok: true,
    fecha: fecha || fechaActualBogota,
    porUsuario: rows,
    totales: { totalVendido: totalGeneral, cuentasCerradas: cuentasGeneral },
  });
});

module.exports = { ventasPorDia, productosMasVendidos, resumen, cuentasDetalle, cierreCaja };
