const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/** GET /api/usuarios - lista de usuarios (solo admin) */
const listar = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre_completo, username, rol, activo, creado_en
     FROM usuarios ORDER BY creado_en DESC`
  );
  res.json({ ok: true, usuarios: rows });
});

/** POST /api/usuarios - crear usuario (solo admin) */
const crear = asyncHandler(async (req, res) => {
  const nombreCompleto = String(req.body.nombreCompleto || '').trim();
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const rol = req.body.rol ? String(req.body.rol).toUpperCase() : 'EMPLEADO';

  if (!nombreCompleto || !username || !password) {
    throw new ApiError(400, 'nombreCompleto, username y password son obligatorios.');
  }
  if (username.length < 3) throw new ApiError(400, 'El usuario debe tener al menos 3 caracteres.');
  if (password.length < 6) throw new ApiError(400, 'La contraseña debe tener al menos 6 caracteres.');
  if (!['ADMIN', 'EMPLEADO'].includes(rol)) {
    throw new ApiError(400, 'El rol debe ser ADMIN o EMPLEADO.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await query(
      `INSERT INTO usuarios (nombre_completo, username, password_hash, rol)
       VALUES ($1, $2, $3, $4::rol_usuario)
       RETURNING id, nombre_completo, username, rol, activo, creado_en`,
      [nombreCompleto, username, passwordHash, rol]
    );

    res.status(201).json({ ok: true, usuario: rows[0] });
  } catch (err) {
    if (err.code === '23505') throw new ApiError(409, 'Ese nombre de usuario ya está registrado.');
    throw err;
  }
});

/** PATCH /api/usuarios/:id - editar usuario */
const actualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const idNum = Number(id);
  const { nombreCompleto, rol, activo, password } = req.body;

  if (!Number.isInteger(idNum) || idNum <= 0) throw new ApiError(400, 'ID de usuario inválido.');

  const { rows: existentes } = await query('SELECT id, rol, activo FROM usuarios WHERE id = $1', [idNum]);
  const existente = existentes[0];
  if (!existente) throw new ApiError(404, 'Usuario no encontrado.');

  if (typeof rol !== 'undefined' && !['ADMIN', 'EMPLEADO'].includes(String(rol).toUpperCase())) {
    throw new ApiError(400, 'El rol debe ser ADMIN o EMPLEADO.');
  }

  if (typeof activo !== 'undefined' && typeof activo !== 'boolean') {
    throw new ApiError(400, 'El estado activo debe ser verdadero o falso.');
  }

  if (password !== undefined && String(password).length > 0 && String(password).length < 6) {
    throw new ApiError(400, 'La contraseña debe tener al menos 6 caracteres.');
  }

  if (idNum === req.usuario.id && activo === false) {
    throw new ApiError(400, 'No puedes desactivar tu propio usuario mientras tienes la sesión iniciada.');
  }

  if (idNum === req.usuario.id && String(rol || '').toUpperCase() === 'EMPLEADO') {
    throw new ApiError(400, 'No puedes quitarte el rol de administrador a ti mismo.');
  }

  if (existente.rol === 'ADMIN' && existente.activo && activo === false) {
    const { rows: admins } = await query(
      `SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'ADMIN' AND activo = TRUE AND id <> $1`,
      [idNum]
    );
    if (admins[0].total === 0) {
      throw new ApiError(400, 'No puedes desactivar el único administrador activo del sistema.');
    }
  }

  let passwordHash = null;
  if (password !== undefined && String(password).length > 0) {
    passwordHash = await bcrypt.hash(String(password), 10);
  }

  const nombreLimpio = nombreCompleto === undefined ? null : String(nombreCompleto).trim();
  if (nombreCompleto !== undefined && !nombreLimpio) {
    throw new ApiError(400, 'El nombre completo no puede estar vacío.');
  }

  const { rows } = await query(
    `UPDATE usuarios SET
        nombre_completo = COALESCE($1, nombre_completo),
        rol = COALESCE($2::rol_usuario, rol),
        activo = COALESCE($3, activo),
        password_hash = COALESCE($4, password_hash)
     WHERE id = $5
     RETURNING id, nombre_completo, username, rol, activo, creado_en`,
    [nombreLimpio, rol ? String(rol).toUpperCase() : null, typeof activo === 'boolean' ? activo : null, passwordHash, idNum]
  );

  res.json({ ok: true, usuario: rows[0] });
});

/** DELETE /api/usuarios/:id - eliminar usuario */
const eliminar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const idNum = Number(id);

  if (!Number.isInteger(idNum) || idNum <= 0) throw new ApiError(400, 'ID de usuario inválido.');
  if (idNum === req.usuario.id) {
    throw new ApiError(400, 'No puedes eliminar tu propio usuario mientras tienes la sesión iniciada.');
  }

  const { rows: existentes } = await query('SELECT id, rol FROM usuarios WHERE id = $1', [idNum]);
  if (!existentes[0]) throw new ApiError(404, 'Usuario no encontrado.');

  if (existentes[0].rol === 'ADMIN') {
    const { rows: admins } = await query(
      `SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'ADMIN' AND activo = TRUE AND id <> $1`,
      [idNum]
    );
    if (admins[0].total === 0) {
      throw new ApiError(400, 'No puedes eliminar el único administrador activo del sistema.');
    }
  }

  try {
    await query('DELETE FROM usuarios WHERE id = $1', [idNum]);
  } catch (err) {
    if (err.code === '23503') {
      throw new ApiError(
        409,
        'Este usuario ya tiene cuentas registradas (aperturas o cierres) y no puede eliminarse. Puedes desactivarlo en su lugar.'
      );
    }
    throw err;
  }

  res.json({ ok: true, mensaje: 'Usuario eliminado correctamente.' });
});

module.exports = { listar, crear, actualizar, eliminar };
