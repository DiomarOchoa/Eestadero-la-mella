// backend/src/controllers/adminController.js
// Panel del dueño del SaaS. Todo aquí es GLOBAL (sin filtro por negocio)
// y está protegido por soloSuperAdmin en las rutas.

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { obtenerPaginacion, respuestaPaginada } = require('../utils/paginacion');

const PLANES_VALIDOS = ['GRATIS', 'BASICO', 'PRO'];

/** GET /api/admin/negocios?q=&activo=&page=&limit= */
const listarNegocios = asyncHandler(async (req, res) => {
  const { q, activo } = req.query;
  const { page, limit, offset } = obtenerPaginacion(req.query, { porDefecto: 20, maximo: 100 });

  const params = [];
  const conds = [];
  if (q) {
    params.push(`%${String(q).trim().toLowerCase()}%`);
    conds.push(`(LOWER(n.nombre) LIKE $${params.length} OR LOWER(n.slug) LIKE $${params.length})`);
  }
  if (activo === 'true' || activo === 'false') {
    params.push(activo === 'true');
    conds.push(`n.activo = $${params.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const [{ rows }, { rows: conteo }] = await Promise.all([
    query(
      `SELECT n.id, n.nombre, n.slug, n.plan, n.activo, n.suscripcion_vence_en,
              n.creado_en,
              (SELECT COUNT(*)::int FROM usuarios u WHERE u.negocio_id = n.id AND u.activo = TRUE) AS usuarios_activos,
              (SELECT COUNT(*)::int FROM cuentas c WHERE c.negocio_id = n.id AND c.estado = 'ABIERTA') AS cuentas_abiertas,
              (SELECT COALESCE(SUM(c.total),0) FROM cuentas c WHERE c.negocio_id = n.id AND c.estado = 'CERRADA'
                AND (c.fecha_cierre AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date) AS vendido_hoy
       FROM negocios n
       ${where}
       ORDER BY n.creado_en DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*)::int AS total FROM negocios n ${where}`, params),
  ]);
  res.json(respuestaPaginada({ page, limit, total: conteo[0].total, datos: rows, clave: 'negocios' }));
});

/** PATCH /api/admin/negocios/:id { plan?, activo?, suscripcion_vence_en?, color_acento?, color_fondo?, logo_url? } */
const actualizarNegocio = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'ID de negocio inválido.');
  const { plan, activo, suscripcion_vence_en, color_acento, color_fondo, logo_url } = req.body;

  if (plan !== undefined && !PLANES_VALIDOS.includes(String(plan).toUpperCase())) {
    throw new ApiError(400, `plan debe ser uno de: ${PLANES_VALIDOS.join(', ')}`);
  }
  if (activo !== undefined && typeof activo !== 'boolean') throw new ApiError(400, 'activo debe ser verdadero o falso.');
  if (suscripcion_vence_en !== undefined && suscripcion_vence_en !== null && !/^\d{4}-\d{2}-\d{2}$/.test(suscripcion_vence_en)) {
    throw new ApiError(400, 'suscripcion_vence_en debe ser YYYY-MM-DD o null.');
  }

  const { rows } = await query(
    `UPDATE negocios SET
       plan = COALESCE($1, plan),
       activo = COALESCE($2, activo),
       suscripcion_vence_en = CASE WHEN $3::text IS NULL THEN suscripcion_vence_en WHEN $3 = 'null' THEN NULL ELSE $3::date END,
       color_acento = COALESCE($4, color_acento),
       color_fondo = COALESCE($5, color_fondo),
       logo_url = COALESCE($6, logo_url)
     WHERE id = $7
     RETURNING id, nombre, slug, plan, activo, suscripcion_vence_en, color_acento, color_fondo, logo_url`,
    [
      plan === undefined ? null : String(plan).toUpperCase(),
      activo === undefined ? null : activo,
      suscripcion_vence_en === undefined ? null : suscripcion_vence_en === null ? 'null' : suscripcion_vence_en,
      color_acento || null,
      color_fondo || null,
      logo_url || null,
      id,
    ]
  );
  if (!rows[0]) throw new ApiError(404, 'Negocio no encontrado.');
  res.json({ ok: true, negocio: rows[0] });
});

/** GET /api/admin/resumen — KPIs globales del SaaS */
const resumenGlobal = asyncHandler(async (req, res) => {
  const [{ rows: neg }, { rows: usr }, { rows: ven }] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE activo)::int AS activos FROM negocios`),
    query(`SELECT COUNT(*)::int AS total FROM usuarios WHERE activo = TRUE`),
    query(`SELECT COALESCE(SUM(total),0) AS hoy FROM cuentas WHERE estado='CERRADA'
      AND (fecha_cierre AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date`),
  ]);
  res.json({ ok: true, resumen: { negocios: neg[0], usuariosActivos: usr[0].total, vendidoHoy: ven[0].hoy } });
});

module.exports = { listarNegocios, actualizarNegocio, resumenGlobal };
