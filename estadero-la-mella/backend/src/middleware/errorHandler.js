const ApiError = require('../utils/ApiError');

/**
 * Middleware de manejo de errores centralizado.
 * Debe registrarse SIEMPRE al final de la cadena de middlewares en app.js.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Error de PostgreSQL: violación de llave foránea
  if (err.code === '23503') {
    return res.status(409).json({
      ok: false,
      mensaje: 'La operación viola una relación existente en la base de datos (referencia inválida).',
    });
  }

  // Error de PostgreSQL: violación de unicidad (ej: username duplicado)
  if (err.code === '23505') {
    return res.status(409).json({
      ok: false,
      mensaje: 'Ya existe un registro con ese valor único (posible duplicado).',
    });
  }

  // Error de PostgreSQL: violación de CHECK constraint (ej: stock negativo)
  if (err.code === '23514') {
    return res.status(400).json({
      ok: false,
      mensaje: 'El valor enviado no cumple una restricción de la base de datos.',
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      ok: false,
      mensaje: err.message,
      detalles: err.details || undefined,
    });
  }

  console.error('Error no controlado:', err);
  return res.status(500).json({
    ok: false,
    mensaje: 'Error interno del servidor.',
  });
}

module.exports = errorHandler;
