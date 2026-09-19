// backend/src/controllers/usuariosController.js
// Versión multi-tenant.
//
// CAMBIO MÁS IMPORTANTE de este archivo: restablecerDatos ya NO usa
// TRUNCATE. La versión anterior borraba TODAS las cuentas, clientes y
// productos de TODO el sistema con un solo clic, sin importar el negocio.
// Ahora borra únicamente las filas de negocio_id = req.negocioId.

const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const listar = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre_completo, username, rol, activo, creado_en
     FROM usuarios WHERE negocio_id = $1 ORDER BY creado_en DESC`,
    [req.negocioId]
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
    // El username ahora es único POR NEGOCIO (ver migración 005), así que
    // "admin" puede existir en cada negocio sin chocar entre ellos.
    const { rows } = await query(
      `INSERT INTO usuarios (negocio_id, nombre_completo, username, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5::rol_usuario)
       RETURNING id, nombre_completo, username, rol, activo, creado_en`,
      [req.negocioId, nombreCompleto, username, passwordHash, rol]
    );
    res.status(201).json({ ok: true, usuario: rows[0] });
  } catch (err) {
    if (err.code === '23505') throw new ApiError(409, 'Ese nombre de usuario ya está registrado en este negocio.');
    throw err;
  }
});

const actualizar = asyncHandler(async (req, res) => {
  const idNum = Number(req.params.id);
  const { nombreCompleto, rol, activo, password } = req.body;
  if (!Number.isInteger(idNum) || idNum <= 0) throw new ApiError(400, 'ID de usuario inválido.');

  const { rows: existentes } = await query(
    'SELECT id, rol, activo FROM usuarios WHERE id = $1 AND negocio_id = $2',
    [idNum, req.negocioId]
  );
  const existente = existentes[0];
  if (!existente) throw new ApiError(404, 'Usuario no encontrado.');

  const rolLimpio = rol === undefined ? null : String(rol).toUpperCase();
  if (rolLimpio !== null && !['ADMIN', 'EMPLEADO'].includes(rolLimpio)) throw new ApiError(400, 'El rol debe ser ADMIN o EMPLEADO.');
  if (activo !== undefined && typeof activo !== 'boolean') throw new ApiError(400, 'El estado activo debe ser verdadero o falso.');
  if (password !== undefined && String(password).length > 0 && String(password).length < 6) throw new ApiError(400, 'La contraseña debe tener al menos 6 caracteres.');

  if (idNum === req.usuario.id && activo === false) throw new ApiError(400, 'No puedes desactivar tu propio usuario mientras tienes la sesión iniciada.');
  if (idNum === req.usuario.id && rolLimpio === 'EMPLEADO') throw new ApiError(400, 'No puedes quitarte el rol de administrador a ti mismo.');

  // "Último admin" ahora se cuenta DENTRO del negocio, no en todo el sistema.
  if (existente.rol === 'ADMIN' && existente.activo && (activo === false || rolLimpio === 'EMPLEADO')) {
    const { rows: admins } = await query(
      `SELECT COUNT(*)::int AS total FROM usuarios WHERE negocio_id = $1 AND rol = 'ADMIN' AND activo = TRUE AND id <> $2`,
      [req.negocioId, idNum]
    );
    if (admins[0].total === 0) throw new ApiError(400, 'No puedes dejar este negocio sin un administrador activo.');
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
     WHERE id = $5 AND negocio_id = $6
     RETURNING id, nombre_completo, username, rol, activo, creado_en`,
    [nombreLimpio, rolLimpio, typeof activo === 'boolean' ? activo : null, passwordHash, idNum, req.negocioId]
  );
  res.json({ ok: true, usuario: rows[0] });
});

const eliminar = asyncHandler(async (req, res) => {
  const idNum = Number(req.params.id);
  if (!Number.isInteger(idNum) || idNum <= 0) throw new ApiError(400, 'ID de usuario inválido.');
  if (idNum === req.usuario.id) throw new ApiError(400, 'No puedes eliminar tu propio usuario mientras tienes la sesión iniciada.');

  const { rows: existentes } = await query(
    'SELECT id, rol FROM usuarios WHERE id = $1 AND negocio_id = $2',
    [idNum, req.negocioId]
  );
  if (!existentes[0]) throw new ApiError(404, 'Usuario no encontrado.');

  if (existentes[0].rol === 'ADMIN') {
    const { rows: admins } = await query(
      `SELECT COUNT(*)::int AS total FROM usuarios WHERE negocio_id = $1 AND rol = 'ADMIN' AND activo = TRUE AND id <> $2`,
      [req.negocioId, idNum]
    );
    if (admins[0].total === 0) throw new ApiError(400, 'No puedes eliminar el único administrador activo de este negocio.');
  }

  try {
    await query('DELETE FROM usuarios WHERE id = $1 AND negocio_id = $2', [idNum, req.negocioId]);
  } catch (err) {
    if (err.code === '23503') throw new ApiError(409, 'Este usuario tiene registros históricos y no puede eliminarse. Puedes desactivarlo en su lugar.');
    throw err;
  }
  res.json({ ok: true, mensaje: 'Usuario eliminado correctamente.' });
});

/**
 * Restablece SOLO los datos del negocio autenticado (nunca los de otros).
 * Antes usaba TRUNCATE sobre las tablas completas: en un sistema con varios
 * negocios eso habría borrado a TODOS los clientes de tu SaaS de un clic.
 * Ahora borra en orden (hijos antes que padres) y sin RESTART IDENTITY,
 * porque los contadores de ID se comparten entre negocios.
 */
const restablecerDatos = asyncHandler(async (req, res) => {
  const confirmacion = String(req.body.confirmacion || '').trim().toUpperCase();
  if (confirmacion !== 'RESTABLECER') throw new ApiError(400, 'Para confirmar el restablecimiento debes escribir RESTABLECER.');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM detalle_cuenta WHERE cuenta_id IN (SELECT id FROM cuentas WHERE negocio_id = $1)`,
      [req.negocioId]
    );
    await client.query(`DELETE FROM cuentas WHERE negocio_id = $1`, [req.negocioId]);
    await client.query(`DELETE FROM caja_turnos WHERE negocio_id = $1`, [req.negocioId]);
    await client.query(`DELETE FROM clientes WHERE negocio_id = $1`, [req.negocioId]);
    await client.query(`DELETE FROM productos WHERE negocio_id = $1`, [req.negocioId]);

    await client.query(
      `INSERT INTO productos (negocio_id, nombre, tipo, precio, stock, stock_minimo) VALUES
        ($1, 'Cerveza Águila Botella', 'CERVEZA', 4500, 120, 24),
        ($1, 'Cerveza Poker Botella', 'CERVEZA', 4500, 100, 24),
        ($1, 'Cerveza Club Colombia Lata', 'CERVEZA', 5000, 80, 24),
        ($1, 'Cerveza Corona Botella', 'CERVEZA', 7000, 60, 12),
        ($1, 'Pony Malta', 'BEBIDA', 3500, 50, 12),
        ($1, 'Hit Mora', 'BEBIDA', 3000, 50, 12),
        ($1, 'Agua Cristal 600ml', 'BEBIDA', 2500, 60, 12),
        ($1, 'Chitos', 'SNACK', 2000, 40, 10),
        ($1, 'Mekatos', 'SNACK', 2000, 40, 10),
        ($1, 'Papas Margarita', 'SNACK', 3000, 30, 10)`,
      [req.negocioId]
    );
    await client.query(
      `INSERT INTO clientes (negocio_id, referencia, notas) VALUES
        ($1, 'Luis', NULL),
        ($1, 'El flaco', NULL),
        ($1, 'Casco negro', 'Cliente frecuente, llega en moto'),
        ($1, 'Mesa 2', 'Referencia de ubicación, no persona fija')`,
      [req.negocioId]
    );

    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Datos de tu negocio restablecidos. Los usuarios se conservaron.' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { listar, crear, actualizar, eliminar, restablecerDatos };
