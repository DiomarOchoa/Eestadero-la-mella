const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Ejecuta las reglas de express-validator declaradas en la ruta
 * y, si hay errores, corta la petición con un 400 detallado.
 */
function validar(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    throw new ApiError(400, 'Datos de entrada inválidos.', errores.array());
  }
  next();
}

module.exports = validar;
