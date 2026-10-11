// backend/src/controllers/adminController.js
// Panel del dueño del SaaS. Todo aquí es GLOBAL (sin filtro por negocio)
// y está protegido por soloSuperAdmin en las rutas.

const { query } = require('../config/db');
const bcrypt = require('bcryptjs');
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
  // El negocio semilla del dueño ('lamella') no es un cliente: se gestiona
  // desde las páginas normales, no desde el panel SaaS.
  const whereSinSemilla = where ? `${where} AND n.slug <> 'lamella'` : `WHERE n.slug <> 'lamella'`;

  const [{ rows }, { rows: conteo }] = await Promise.all([
    query(
      `SELECT n.id, n.nombre, n.slug, n.plan, n.activo, n.suscripcion_vence_en,
              n.creado_en,
              (SELECT COUNT(*)::int FROM usuarios u WHERE u.negocio_id = n.id AND u.activo = TRUE) AS usuarios_activos,
              (SELECT COUNT(*)::int FROM cuentas c WHERE c.negocio_id = n.id AND c.estado = 'ABIERTA') AS cuentas_abiertas,
              (SELECT COALESCE(SUM(c.total),0) FROM cuentas c WHERE c.negocio_id = n.id AND c.estado = 'CERRADA'
                AND (c.fecha_cierre AT TIME ZONE 'America/Bogota')::date = (NOW() AT TIME ZONE 'America/Bogota')::date) AS vendido_hoy
       FROM negocios n
       ${whereSinSemilla}
       ORDER BY n.creado_en DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*)::int AS total FROM negocios n ${whereSinSemilla}`, params),
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

  // El negocio semilla del dueño no se suspende ni se edita su plan desde aquí.
  const { rows: semilla } = await query('SELECT slug FROM negocios WHERE id = $1', [id]);
  if (!semilla[0]) throw new ApiError(404, 'Negocio no encontrado.');
  if (semilla[0].slug === 'lamella' && (activo === false || plan !== undefined)) {
    throw new ApiError(400, 'Tu propio negocio no se suspende ni cambia de plan desde este panel.');
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

/**
 * POST /api/admin/bootstrap (público, un solo uso)
 * Crea el PRIMER superadmin sin necesitar Shell (planes free de Render no tienen Shell).
 * Body: { setupSecret, username, password, nombreCompleto? }
 * - setupSecret debe igualar ADMIN_SETUP_SECRET del servidor.
 * - Falla si ya existe algún SUPERADMIN (solo el primero).
 * Tras usarlo, BORRA ADMIN_SETUP_SECRET de Render y redeploya.
 */
const bootstrap = asyncHandler(async (req, res) => {
  const esperado = process.env.ADMIN_SETUP_SECRET || '';
  if (!esperado) throw new ApiError(500, 'Bootstrap no configurado (ADMIN_SETUP_SECRET).');
  if (String(req.body.setupSecret || '') !== esperado) {
    throw new ApiError(401, 'Secreto de instalación inválido.');
  }
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const nombreCompleto = String(req.body.nombreCompleto || 'Super Admin').trim();
  if (!username || username.length < 3 || username.length > 50) {
    throw new ApiError(400, 'username de 3 a 50 caracteres.');
  }
  if (!password || password.length < 8) {
    throw new ApiError(400, 'password de al menos 8 caracteres.');
  }
  const { rows: existentes } = await query(`SELECT 1 FROM usuarios WHERE rol = 'SUPERADMIN' LIMIT 1`);
  if (existentes[0]) throw new ApiError(409, 'Ya existe un superadmin. Usa el panel /admin/negocios.');
  const { rows: neg } = await query(`SELECT id FROM negocios WHERE slug = 'lamella' LIMIT 1`);
  if (!neg[0]) throw new ApiError(500, "No existe el negocio 'lamella'.");
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO usuarios (negocio_id, nombre_completo, username, password_hash, rol, activo)
     VALUES ($1, $2, $3, $4, 'SUPERADMIN', TRUE)
     RETURNING id, username, rol`,
    [neg[0].id, nombreCompleto, username, hash]
  );
  res.status(201).json({ ok: true, usuario: rows[0] });
});

/**
 * DELETE /api/admin/negocios/:id (solo superadmin)
 * Elimina el negocio y TODOS sus datos (cuentas, caja, clientes, productos, usuarios).
 * Pide confirmación { confirmacion: slug } para evitar borrados accidentales.
 */
const eliminarNegocio = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'ID de negocio inválido.');
  const confirmacion = String(req.body?.confirmacion || '').trim().toLowerCase();

  const { getClient } = require('../config/db');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id, nombre, slug FROM negocios WHERE id = $1', [id]);
    if (!rows[0]) throw new ApiError(404, 'Negocio no encontrado.');
    if (rows[0].slug === 'lamella') {
      throw new ApiError(400, 'Tu propio negocio no se puede eliminar desde este panel.');
    }
    if (confirmacion !== rows[0].slug.toLowerCase()) {
      throw new ApiError(400, `Para eliminar escribe el slug del negocio ("${rows[0].slug}") en confirmacion.`);
    }
    // Orden hijos → padres (detalle_cuenta cae por CASCADE desde cuentas).
    await client.query('DELETE FROM cuentas WHERE negocio_id = $1', [id]);
    await client.query('DELETE FROM caja_turnos WHERE negocio_id = $1', [id]);
    await client.query('DELETE FROM clientes WHERE negocio_id = $1', [id]);
    await client.query('DELETE FROM productos WHERE negocio_id = $1', [id]);
    await client.query('DELETE FROM usuarios WHERE negocio_id = $1', [id]);
    await client.query('DELETE FROM negocios WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true, mensaje: `Negocio "${rows[0].nombre}" y todos sus datos eliminados.` });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/negocios/:id/usuarios (solo superadmin)
 * Usuarios de un negocio para el panel SaaS (filas expandibles).
 */
const usuariosPorNegocio = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, 'ID de negocio inválido.');
  const { rows: neg } = await query('SELECT id, nombre, slug FROM negocios WHERE id = $1', [id]);
  if (!neg[0]) throw new ApiError(404, 'Negocio no encontrado.');
  const { rows } = await query(
    `SELECT id, nombre_completo, username, rol, activo, creado_en
     FROM usuarios WHERE negocio_id = $1 ORDER BY creado_en DESC`,
    [id]
  );
  res.json({ ok: true, negocio: neg[0], usuarios: rows });
});

/**
 * POST /api/admin/recuperar (público con secreto, solo emergencias)
 * Recupera acceso de un SUPERADMIN sin necesitar Shell ni DB directa.
 * Body: { setupSecret, username, nuevoPassword?, reactivarSlug? }
 * - setupSecret debe igualar ADMIN_SETUP_SECRET.
 * - Solo opera sobre usuarios con rol SUPERADMIN.
 * - nuevoPassword (8+): cambia clave y reactiva el usuario.
 * - reactivarSlug: reactiva el negocio (por si se desactivó por error).
 * Tras usarlo, BORRA ADMIN_SETUP_SECRET y redeploya.
 */
const recuperar = asyncHandler(async (req, res) => {
  const esperado = process.env.ADMIN_SETUP_SECRET || '';
  if (!esperado) throw new ApiError(500, 'Recuperación no configurada (ADMIN_SETUP_SECRET).');
  if (String(req.body.setupSecret || '') !== esperado) {
    throw new ApiError(401, 'Secreto de instalación inválido.');
  }
  const username = String(req.body.username || '').trim().toLowerCase();
  if (!username) throw new ApiError(400, 'username es obligatorio.');

  const { rows } = await query(
    `SELECT u.id, u.rol, u.activo, n.slug AS negocio_slug, n.activo AS negocio_activo
     FROM usuarios u JOIN negocios n ON n.id = u.negocio_id
     WHERE LOWER(u.username) = $1 AND u.rol = 'SUPERADMIN' LIMIT 1`,
    [username]
  );
  if (!rows[0]) throw new ApiError(404, 'Superadmin no encontrado.');
  const cambios = [];

  const nuevoPassword = String(req.body.nuevoPassword || '');
  if (nuevoPassword) {
    if (nuevoPassword.length < 8) throw new ApiError(400, 'nuevoPassword de al menos 8 caracteres.');
    const hash = await bcrypt.hash(nuevoPassword, 10);
    await query('UPDATE usuarios SET password_hash = $1, activo = TRUE WHERE id = $2', [hash, rows[0].id]);
    cambios.push('clave restablecida');
  }

  const reactivarSlug = String(req.body.reactivarSlug || '').trim().toLowerCase();
  if (reactivarSlug) {
    const { rows: up } = await query(
      'UPDATE negocios SET activo = TRUE WHERE slug = $1 RETURNING slug',
      [reactivarSlug]
    );
    if (!up[0]) throw new ApiError(404, 'Negocio a reactivar no encontrado.');
    cambios.push(`negocio ${up[0].slug} reactivado`);
  }

  if (!cambios.length) {
    return res.json({
      ok: true,
      diagnostico: {
        usuarioActivo: rows[0].activo,
        negocio: rows[0].negocio_slug,
        negocioActivo: rows[0].negocio_activo,
      },
    });
  }
  res.json({ ok: true, cambios });
});

module.exports = { listarNegocios, actualizarNegocio, resumenGlobal, bootstrap, eliminarNegocio, usuariosPorNegocio, recuperar };
