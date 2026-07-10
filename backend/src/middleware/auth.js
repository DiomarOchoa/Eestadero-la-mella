const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

/**
 * Verifica que la petición traiga un JWT válido en el header Authorization.
 * Formato esperado: "Authorization: Bearer <token>"
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'No autenticado. Debes iniciar sesión.');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, username, rol }
    next();
  } catch (err) {
    throw new ApiError(401, 'Sesión inválida o expirada. Inicia sesión de nuevo.');
  }
}

/**
 * Middleware de autorización por rol.
 * Uso: autorizar('ADMIN') o autorizar('ADMIN', 'EMPLEADO')
 */
function autorizar(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      throw new ApiError(401, 'No autenticado.');
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      throw new ApiError(403, 'No tienes permisos para realizar esta acción.');
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
