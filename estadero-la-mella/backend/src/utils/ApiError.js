/**
 * Error de aplicación controlado, con código HTTP asociado.
 * Permite diferenciar errores esperados (ej: 404, 400, 401)
 * de errores inesperados del servidor (500).
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
