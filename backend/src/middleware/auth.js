const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'No autenticado. Debes iniciar sesión.'));
  }

  const token = authHeader.slice(7).trim();
  if (!token) return next(new ApiError(401, 'Sesión inválida. Inicia sesión de nuevo.'));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    query(
      `SELECT id, nombre_completo, username, rol, activo
       FROM usuarios WHERE id = $1`,
      [payload.id]
    )
      .then(({ rows }) => {
        const usuario = rows[0];
        if (!usuario || !usuario.activo) {
          return next(new ApiError(401, 'Tu usuario está inactivo. Inicia sesión con un usuario activo.'));
        }

        req.usuario = {
          id: usuario.id,
          nombreCompleto: usuario.nombre_completo,
          username: usuario.username,
          rol: usuario.rol,
        };
        next();
      })
      .catch((err) => next(err));
  } catch (err) {
    return next(new ApiError(401, 'Sesión inválida o expirada. Inicia sesión de nuevo.'));
  }
}

function autorizar(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) return next(new ApiError(401, 'No autenticado.'));
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(new ApiError(403, 'No tienes permisos para realizar esta acción.'));
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
