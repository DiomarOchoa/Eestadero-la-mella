// backend/src/middleware/auth.js
// Versión multi-tenant: además de identificar al usuario, resuelve a qué
// negocio pertenece y deja ese id disponible para TODOS los controladores.

const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');

/**
 * Verifica el JWT, carga el usuario y su negocio, y expone:
 *   req.usuario   -> { id, nombreCompleto, username, rol, negocioId }
 *   req.negocioId -> atajo que usan todos los controladores para filtrar
 *   req.negocio   -> { id, nombre, slug, plan, venceEn }
 */
async function autenticar(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'No autenticado. Debes iniciar sesión.');
    }

    const token = authHeader.slice(7).trim();
    if (!token) throw new ApiError(401, 'Sesión inválida. Inicia sesión de nuevo.');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new ApiError(401, 'Sesión inválida o expirada. Inicia sesión de nuevo.');
    }

    if (!payload.negocioId) {
      // Token emitido por la versión anterior (sin multi-tenant)
      throw new ApiError(401, 'Tu sesión es de una versión anterior. Inicia sesión de nuevo.');
    }

    const { rows } = await query(
      `SELECT u.id, u.nombre_completo, u.username, u.rol, u.activo,
              n.id   AS negocio_id,
              n.nombre AS negocio_nombre,
              n.slug AS negocio_slug,
              n.plan,
              n.activo AS negocio_activo,
              n.suscripcion_vence_en
       FROM usuarios u
       JOIN negocios n ON n.id = u.negocio_id
       WHERE u.id = $1 AND u.negocio_id = $2`,
      [payload.id, payload.negocioId]
    );

    const fila = rows[0];
    if (!fila) throw new ApiError(401, 'Sesión inválida. Inicia sesión de nuevo.');
    if (!fila.activo) {
      throw new ApiError(401, 'Tu usuario está inactivo. Inicia sesión con un usuario activo.');
    }
    if (!fila.negocio_activo) {
      throw new ApiError(403, 'Este negocio está suspendido. Contacta al administrador del servicio.');
    }

    req.usuario = {
      id: fila.id,
      nombreCompleto: fila.nombre_completo,
      username: fila.username,
      rol: fila.rol,
      negocioId: fila.negocio_id,
    };

    req.negocioId = fila.negocio_id;

    req.negocio = {
      id: fila.negocio_id,
      nombre: fila.negocio_nombre,
      slug: fila.negocio_slug,
      plan: fila.plan,
      venceEn: fila.suscripcion_vence_en,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/** Autorización por rol dentro del negocio (sin cambios de comportamiento). */
function autorizar(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) return next(new ApiError(401, 'No autenticado.'));
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(new ApiError(403, 'No tienes permisos para realizar esta acción.'));
    }
    next();
  };
}

/**
 * Bloquea operaciones cuando la suscripción venció.
 * Se monta solo en rutas de ESCRITURA, para que un negocio moroso siga pudiendo
 * entrar y consultar sus datos (y por tanto, pagar) pero no siga operando.
 *
 *   router.post('/', autenticar, requerirSuscripcionActiva, crear)
 */
function requerirSuscripcionActiva(req, res, next) {
  const vence = req.negocio?.venceEn;
  if (!vence) return next(); // sin vencimiento configurado

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (new Date(vence) < hoy) {
    return next(new ApiError(402, 'La suscripción de este negocio venció. Renuévala para seguir registrando ventas.'));
  }
  next();
}

/** Solo para el panel del dueño del SaaS (crear negocios, ver todos los planes). */
function soloSuperAdmin(req, res, next) {
  if (req.usuario?.rol !== 'SUPERADMIN') {
    return next(new ApiError(403, 'Acción reservada al administrador del servicio.'));
  }
  next();
}

module.exports = { autenticar, autorizar, requerirSuscripcionActiva, soloSuperAdmin };
