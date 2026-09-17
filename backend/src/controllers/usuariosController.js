const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const listar = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre_completo, username, rol, activo, creado_en
     FROM usuarios ORDER BY creado_en DESC`
  );
  res.json({ ok: true, usuarios: rows });
});

const crear = asyncHandler(async (req, res) => {
  const nombreCompleto = String(req.body.nombreCompleto || '').trim();
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const rol = req.body.rol ? String(req.body.rol).toUpperCase() : 'EMPLEADO';

  if (!nombreCompleto || !username || !password) throw new ApiError(400, 'Nombre completo, usuario y contraseña son obligatorios.');
  if (username.length < 3 || username.length > 50) throw new ApiError(400, 'El usuario debe tener entre 3 y 50 caracteres.');
  if (password.length < 6) throw new ApiError(400, 'La contraseña debe tener al menos 6 caracteres.');
  if (!['ADMIN', 'EMPLEADO'].includes(rol)) throw new ApiError(400, 'El rol debe ser ADMIN o EMPLEADO.');

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

const actualizar = asyncHandler(async (req, res) => {
  const idNum = Number(req.params.id);
  const { nombreCompleto, rol, activo, password } = req.body;
  if (!Number.isInteger(idNum) || idNum <= 0) throw new ApiError(400, 'ID de usuario inválido.');

  const { rows: existentes } = await query('SELECT id, rol, activo FROM usuarios WHERE id = $1', [idNum]);
  const existente = existentes[0];
  if (!existente) throw new ApiError(404, 'Usuario no encontrado.');

  const rolLimpio = rol === undefined ? null : String(rol).toUpperCase();
  if (rolLimpio !== null && !['ADMIN', 'EMPLEADO'].includes(rolLimpio)) throw new ApiError(400, 'El rol debe ser ADMIN o EMPLEADO.');
  if (activo !== undefined && typeof activo !== 'boolean') throw new ApiError(400, 'El estado activo debe ser verdadero o falso.');
  if (password !== undefined && String(password).length > 0 && String(password).length < 6) throw new ApiError(400, 'La contraseña debe tener al menos 6 caracteres.');

  if (idNum === req.usuario.id && activo === false) throw new ApiError(400, 'No puedes desactivar tu propio usuario mientras tienes la sesión iniciada.');
  if (idNum === req.usuario.id && rolLimpio === 'EMPLEADO') throw new ApiError(400, 'No puedes quitarte el rol de administrador a ti mismo.');

  if (existente.rol === 'ADMIN' && existente.activo && (activo === false || rolLimpio === 'EMPLEADO')) {
    const { rows: admins } = await query(`SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'ADMIN' AND activo = TRUE AND id <> $1`, [idNum]);
    if (admins[0].total === 0) throw new ApiError(400, 'No puedes dejar el sistema sin un administrador activo.');
  }

  const nombreLimpio = nombreCompleto === undefined ? null : String(nombreCompleto).trim();
  if (nombreCompleto !== undefined && !nombreLimpio) throw new ApiError(400, 'El nombre completo no puede estar vacío.');
  const passwordHash = password && String(password).length > 0 ? await bcrypt.hash(String(password), 10) : null;

  const { rows } = await query(
    `UPDATE usuarios SET
        nombre_completo = COALESCE($1, nombre_completo),
        rol = COALESCE($2::rol_usuario, rol),
        activo = COALESCE($3, activo),
        password_hash = COALESCE($4, password_hash)
     WHERE id = $5
     RETURNING id, nombre_completo, username, rol, activo, creado_en`,
    [nombreLimpio, rolLimpio, typeof activo === 'boolean' ? activo : null, passwordHash, idNum]
  );
  res.json({ ok: true, usuario: rows[0] });
});

const eliminar = asyncHandler(async (req, res) => {
  const idNum = Number(req.params.id);
  if (!Number.isInteger(idNum) || idNum <= 0) throw new ApiError(400, 'ID de usuario inválido.');
  if (idNum === req.usuario.id) throw new ApiError(400, 'No puedes eliminar tu propio usuario mientras tienes la sesión iniciada.');

  const { rows: existentes } = await query('SELECT id, rol FROM usuarios WHERE id = $1', [idNum]);
  if (!existentes[0]) throw new ApiError(404, 'Usuario no encontrado.');

  if (existentes[0].rol === 'ADMIN') {
    const { rows: admins } = await query(`SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'ADMIN' AND activo = TRUE AND id <> $1`, [idNum]);
    if (admins[0].total === 0) throw new ApiError(400, 'No puedes eliminar el único administrador activo del sistema.');
  }

  try {
    await query('DELETE FROM usuarios WHERE id = $1', [idNum]);
  } catch (err) {
    if (err.code === '23503') throw new ApiError(409, 'Este usuario tiene registros históricos y no puede eliminarse. Puedes desactivarlo en su lugar.');
    throw err;
  }
  res.json({ ok: true, mensaje: 'Usuario eliminado correctamente.' });
});

const restablecerDatos = asyncHandler(async (req, res) => {
  const confirmacion = String(req.body.confirmacion || '').trim().toUpperCase();
  if (confirmacion !== 'RESTABLECER') throw new ApiError(400, 'Para confirmar el restablecimiento debes escribir RESTABLECER.');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE detalle_cuenta, cuentas, caja_turnos, clientes, productos RESTART IDENTITY CASCADE');
    await client.query(`
      INSERT INTO productos (nombre, tipo, precio, stock, stock_minimo) VALUES
        ('Cerveza Águila Botella', 'CERVEZA', 4500, 120, 24),
        ('Cerveza Poker Botella', 'CERVEZA', 4500, 100, 24),
        ('Cerveza Club Colombia Lata', 'CERVEZA', 5000, 80, 24),
        ('Cerveza Corona Botella', 'CERVEZA', 7000, 60, 12),
        ('Pony Malta', 'BEBIDA', 3500, 50, 12),
        ('Hit Mora', 'BEBIDA', 3000, 50, 12),
        ('Agua Cristal 600ml', 'BEBIDA', 2500, 60, 12),
        ('Chitos', 'SNACK', 2000, 40, 10),
        ('Mekatos', 'SNACK', 2000, 40, 10),
        ('Papas Margarita', 'SNACK', 3000, 30, 10)
    `);
    await client.query(`
      INSERT INTO clientes (referencia, notas) VALUES
        ('Luis', NULL),
        ('El flaco', NULL),
        ('Casco negro', 'Cliente frecuente, llega en moto'),
        ('Mesa 2', 'Referencia de ubicación, no persona fija')
    `);
    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Datos del negocio restablecidos. Los usuarios se conservaron.' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { listar, crear, actualizar, eliminar, restablecerDatos };
