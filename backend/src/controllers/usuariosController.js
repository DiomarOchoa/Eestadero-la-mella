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
  const { nombreCompleto, username, password, rol } = req.body;

  if (!nombreCompleto || !username || !password) {
    throw new ApiError(400, 'nombreCompleto, username y password son obligatorios.');
  }
  if (rol && !['ADMIN', 'EMPLEADO'].includes(rol)) {
    throw new ApiError(400, 'El rol debe ser ADMIN o EMPLEADO.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await query(
    `INSERT INTO usuarios (nombre_completo, username, password_hash, rol)
     VALUES ($1, $2, $3, COALESCE($4::rol_usuario, 'EMPLEADO'))
     RETURNING id, nombre_completo, username, rol, activo, creado_en`,
    [nombreCompleto, username, passwordHash, rol]
  );

  res.status(201).json({ ok: true, usuario: rows[0] });
});

/** PATCH /api/usuarios/:id - editar usuario (rol, activo, nombre, password opcional) */
const actualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombreCompleto, rol, activo, password } = req.body;

  const { rows: existentes } = await query('SELECT id FROM usuarios WHERE id = $1', [id]);
  if (!existentes[0]) throw new ApiError(404, 'Usuario no encontrado.');

  let passwordHash = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  const { rows } = await query(
    `UPDATE usuarios SET
        nombre_completo = COALESCE($1, nombre_completo),
        rol = COALESCE($2::rol_usuario, rol),
        activo = COALESCE($3, activo),
        password_hash = COALESCE($4, password_hash)
     WHERE id = $5
     RETURNING id, nombre_completo, username, rol, activo, creado_en`,
    [nombreCompleto, rol, activo, passwordHash, id]
  );

  res.json({ ok: true, usuario: rows[0] });
});

/** DELETE /api/usuarios/:id - eliminar usuario (solo admin) */
const eliminar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const idNum = Number(id);

  if (idNum === req.usuario.id) {
    throw new ApiError(400, 'No puedes eliminar tu propio usuario mientras tienes la sesión iniciada.');
  }

  const { rows: existentes } = await query('SELECT id, rol FROM usuarios WHERE id = $1', [id]);
  if (!existentes[0]) throw new ApiError(404, 'Usuario no encontrado.');

  if (existentes[0].rol === 'ADMIN') {
    const { rows: admins } = await query(
      `SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'ADMIN' AND activo = TRUE`
    );
    if (admins[0].total <= 1) {
      throw new ApiError(400, 'No puedes eliminar el único administrador activo del sistema.');
    }
  }

  try {
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
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
