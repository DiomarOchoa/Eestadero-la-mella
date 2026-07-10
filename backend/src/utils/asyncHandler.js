/**
 * Envuelve un controlador async para capturar errores y pasarlos
 * automáticamente al middleware de manejo de errores (next(err)).
 * Evita repetir try/catch en cada controlador.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
