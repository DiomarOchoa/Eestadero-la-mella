const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/reportes/ventas-por-dia?dias=14
 * Total vendido (cuentas cerradas) agrupado por día, últimos N días.
 */
const ventasPorDia = asyncHandler(async (req, res) => {
  const dias = Number(req.query.dias) || 14;
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

module.exports = { ventasPorDia, productosMasVendidos, resumen };
