const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/reportes/ventas-por-dia?dias=14
 * Total vendido (cuentas cerradas) agrupado por día, últimos N días.
 */
const ventasPorDia = asyncHandler(async (req, res) => {
  const dias = Number(req.query.dias) || 30;
  const { rows } = await query(
    `SELECT DATE(fecha_cierre) AS fecha,
            COUNT(*) AS cuentas_cerradas,
            SUM(total) AS total_vendido
     FROM cuentas
     WHERE estado = 'CERRADA'
       AND fecha_cierre >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY DATE(fecha_cierre)
     ORDER BY fecha ASC`,
    [dias]
  );
  res.json({ ok: true, ventasPorDia: rows });
});

/**
 * GET /api/reportes/productos-mas-vendidos?limite=10
 * Ranking de productos por unidades vendidas (basado en cuentas cerradas).
 */
const productosMasVendidos = asyncHandler(async (req, res) => {
  const limite = Number(req.query.limite) || 10;
  const { rows } = await query(
    `SELECT p.id, p.nombre, p.tipo,
            SUM(d.cantidad) AS unidades_vendidas,
            SUM(d.subtotal) AS total_generado
     FROM detalle_cuenta d
     JOIN productos p ON p.id = d.producto_id
     JOIN cuentas c ON c.id = d.cuenta_id
     WHERE c.estado = 'CERRADA'
     GROUP BY p.id, p.nombre, p.tipo
     ORDER BY unidades_vendidas DESC
     LIMIT $1`,
    [limite]
  );
  res.json({ ok: true, productosMasVendidos: rows });
});

/**
 * GET /api/reportes/resumen
 * Resumen rápido para el dashboard: cuentas abiertas, ventas de hoy, alertas de stock.
 */
const resumen = asyncHandler(async (req, res) => {
  const [{ rows: abiertas }, { rows: hoy }, { rows: bajoStock }] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM cuentas WHERE estado = 'ABIERTA'`),
    query(
      `SELECT COALESCE(SUM(total), 0) AS total_hoy, COUNT(*)::int AS cuentas_hoy
       FROM cuentas WHERE estado = 'CERRADA' AND DATE(fecha_cierre) = CURRENT_DATE`
    ),
    query(`SELECT COUNT(*)::int AS total FROM productos WHERE activo = TRUE AND stock <= stock_minimo`),
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

/**
 * GET /api/reportes/cuentas-detalle?dias=14
 * Historial de cuentas cerradas, con el nombre/referencia del cliente
 * tal como aparece al abrir la cuenta (ej. "Casco negro", "Mesa 2"),
 * y el detalle de productos consumidos en cada una.
 */
const cuentasDetalle = asyncHandler(async (req, res) => {
  const dias = Number(req.query.dias) || 30;
  const { rows } = await query(
    `SELECT c.id,
            cl.referencia        AS cliente,
            c.total,
            c.metodo_pago,
            c.para_llevar,
            c.fecha_apertura,
            c.fecha_cierre,
            u.nombre_completo    AS atendido_por,
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
     WHERE c.estado = 'CERRADA'
       AND c.fecha_cierre >= NOW() - ($1 || ' days')::INTERVAL
     ORDER BY c.fecha_cierre DESC`,
    [dias]
  );
  res.json({ ok: true, cuentasDetalle: rows });
});

/**
 * GET /api/reportes/cierre-caja?fecha=YYYY-MM-DD
 * Cuánto vendió cada persona en un día puntual (por defecto, hoy), desglosado
 * por método de pago. Pensado para cuadrar caja al final del turno/día.
 */
const cierreCaja = asyncHandler(async (req, res) => {
  const fecha = req.query.fecha || null; // null => CURRENT_DATE en la consulta

  const { rows } = await query(
    `SELECT u.id                    AS usuario_id,
            u.nombre_completo       AS usuario,
            COUNT(*)::int           AS cuentas_cerradas,
            SUM(c.total)            AS total_vendido,
            SUM(c.total) FILTER (WHERE c.metodo_pago = 'EFECTIVO')      AS total_efectivo,
            SUM(c.total) FILTER (WHERE c.metodo_pago = 'TRANSFERENCIA') AS total_transferencia,
            SUM(c.total) FILTER (WHERE c.metodo_pago = 'TARJETA')       AS total_tarjeta,
            SUM(c.total) FILTER (WHERE c.metodo_pago = 'MIXTO')        AS total_mixto
     FROM cuentas c
     JOIN usuarios u ON u.id = c.usuario_cierre_id
     WHERE c.estado = 'CERRADA'
       AND DATE(c.fecha_cierre) = COALESCE($1::date, CURRENT_DATE)
     GROUP BY u.id, u.nombre_completo
     ORDER BY total_vendido DESC`,
    [fecha]
  );

  const totalGeneral = rows.reduce((acc, r) => acc + Number(r.total_vendido), 0);
  const cuentasGeneral = rows.reduce((acc, r) => acc + Number(r.cuentas_cerradas), 0);

  res.json({
    ok: true,
    fecha: fecha || new Date().toISOString().slice(0, 10),
    porUsuario: rows,
    totales: { totalVendido: totalGeneral, cuentasCerradas: cuentasGeneral },
  });
});

module.exports = { ventasPorDia, productosMasVendidos, resumen, cuentasDetalle, cierreCaja };
