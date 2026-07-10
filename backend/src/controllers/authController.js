const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * POST /api/auth/login
 * Valida credenciales y devuelve un JWT con el payload { id, username, rol }.
 */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ApiError(400, 'Usuario y contraseña son obligatorios.');
  }

  const { rows } = await query(
    `SELECT id, nombre_completo, username, password_hash, rol, activo
     FROM usuarios WHERE username = $1`,
    [username]
  );

  const usuario = rows[0];
  if (!usuario || !usuario.activo) {
    throw new ApiError(401, 'Usuario o contraseña incorrectos.');
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) {
    throw new ApiError(401, 'Usuario o contraseña incorrectos.');
  }

  const payload = { id: usuario.id, username: usuario.username, rol: usuario.rol };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  res.json({
    ok: true,
    token,
    usuario: {
      id: usuario.id,
      nombreCompleto: usuario.nombre_completo,
      username: usuario.username,
      rol: usuario.rol,
    },
  });
});

/**
 * GET /api/auth/me
 * Devuelve la información del usuario autenticado (a partir del token).
 */
const me = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre_completo, username, rol, activo FROM usuarios WHERE id = $1`,
    [req.usuario.id]
  );
  if (!rows[0]) throw new ApiError(404, 'Usuario no encontrado.');
  res.json({ ok: true, usuario: rows[0] });
});

module.exports = { login, me };
