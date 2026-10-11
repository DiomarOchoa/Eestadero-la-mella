// backend/src/controllers/authController.js
// Versión multi-tenant.
//
// Cambio clave: ahora "admin" existe en cada negocio, así que el login debe
// saber A QUÉ NEGOCIO pertenece quien está entrando. Se resuelve, en orden:
//   1. subdominio            lamella.tuapp.com  -> slug "lamella"
//   2. header  X-Negocio-Slug (útil para la app móvil / PWA)
//   3. campo   negocio       en el body del login
//   4. si solo existe UN negocio en la base, se usa ese (modo local / legacy)

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Subdominios que NO son negocios
const SUBDOMINIOS_RESERVADOS = new Set(['www', 'api', 'app', 'admin', 'localhost', 'onrender', 'vercel', 'railway']);

function slugDesdeHost(host) {
  if (!host) return null;
  const nombre = host.split(':')[0];              // quita el puerto
  const partes = nombre.split('.');
  if (partes.length < 3) return null;             // tuapp.com -> sin subdominio
  const sub = partes[0].toLowerCase();
  const dominioPrincipal = partes.slice(-2).join('.').toLowerCase();
  const plataformas = new Set(['onrender.com', 'vercel.app', 'railway.app']);
  if (plataformas.has(dominioPrincipal)) return null;
  return SUBDOMINIOS_RESERVADOS.has(sub) ? null : sub;
}

/** Devuelve el negocio al que corresponde esta petición de login. */
async function resolverNegocio(req) {
  const slug =
    slugDesdeHost(req.headers.host) ||
    (req.headers['x-negocio-slug'] || '').trim().toLowerCase() ||
    String(req.body.negocio || '').trim().toLowerCase();

  if (slug) {
    const { rows } = await query(
      'SELECT id, nombre, slug, activo FROM negocios WHERE slug = $1',
      [slug]
    );
    if (!rows[0]) throw new ApiError(404, 'Ese negocio no existe.');
    return rows[0];
  }

  // Sin pista alguna: solo funciona si hay un único negocio (desarrollo local).
  const { rows } = await query('SELECT id, nombre, slug, activo FROM negocios LIMIT 2');
  if (rows.length === 1) return rows[0];

  throw new ApiError(400, 'Indica el negocio al que quieres entrar.');
}

/**
 * POST /api/auth/login
 * Body: { username, password, negocio? }
 * El campo negocio es OPCIONAL: solo se pide cuando el mismo username
 * existe en varios negocios. Si existe en uno solo, se resuelve solo.
 */
const login = asyncHandler(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!username || !password) {
    throw new ApiError(400, 'Usuario y contraseña son obligatorios.');
  }

  const slugPista =
    slugDesdeHost(req.headers.host) ||
    String(req.headers['x-negocio-slug'] || '').trim().toLowerCase() ||
    String(req.body.negocio || '').trim().toLowerCase();

  let negocio = null;

  if (slugPista) {
    const { rows } = await query(
      'SELECT id, nombre, slug, activo FROM negocios WHERE slug = $1',
      [slugPista]
    );
    if (!rows[0]) throw new ApiError(404, 'Ese negocio no existe.');
    negocio = rows[0];
  } else {
    // Sin slug: ¿en cuántos negocios existe este username activo?
    const { rows } = await query(
      `SELECT n.id, n.nombre, n.slug, n.activo
       FROM usuarios u
       JOIN negocios n ON n.id = u.negocio_id
       WHERE LOWER(u.username) = $1 AND u.activo = TRUE AND n.activo = TRUE`,
      [username]
    );
    if (rows.length === 0) {
      // Respuesta genérica: no revelamos si el usuario existe.
      throw new ApiError(401, 'Usuario o contraseña incorrectos.');
    }
    if (rows.length > 1) {
      throw new ApiError(400, 'Tu usuario existe en varios negocios. Escribe el negocio para entrar.');
    }
    negocio = rows[0];
  }
  if (!negocio.activo) {
    throw new ApiError(403, 'Este negocio está suspendido. Contacta al administrador del servicio.');
  }

  const { rows } = await query(
    `SELECT id, nombre_completo, username, password_hash, rol, activo
     FROM usuarios
     WHERE LOWER(username) = $1 AND negocio_id = $2`,
    [username, negocio.id]
  );

  const usuario = rows[0];

  // Mensaje idéntico en todos los casos: no revelamos si el usuario existe.
  if (!usuario || !usuario.activo) {
    throw new ApiError(401, 'Usuario o contraseña incorrectos.');
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValida) {
    throw new ApiError(401, 'Usuario o contraseña incorrectos.');
  }

  const token = jwt.sign(
    { id: usuario.id, username: usuario.username, rol: usuario.rol, negocioId: negocio.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    ok: true,
    token,
    usuario: {
      id: usuario.id,
      nombreCompleto: usuario.nombre_completo,
      username: usuario.username,
      rol: usuario.rol,
    },
    negocio: { id: negocio.id, nombre: negocio.nombre, slug: negocio.slug },
  });
});

/**
 * GET /api/auth/me
 * Devuelve usuario + negocio + branding, para que el frontend pinte los colores
 * del local en vez de los colores fijos de tokens.css.
 */
const me = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.nombre_completo, u.username, u.rol, u.activo,
            n.id AS negocio_id, n.nombre AS negocio_nombre, n.slug AS negocio_slug,
            n.plan, n.suscripcion_vence_en,
            n.color_acento, n.color_fondo, n.logo_url
     FROM usuarios u
     JOIN negocios n ON n.id = u.negocio_id
     WHERE u.id = $1 AND u.negocio_id = $2`,
    [req.usuario.id, req.negocioId]
  );

  const fila = rows[0];
  if (!fila) throw new ApiError(404, 'Usuario no encontrado.');

  res.json({
    ok: true,
    usuario: {
      id: fila.id,
      nombreCompleto: fila.nombre_completo,
      username: fila.username,
      rol: fila.rol,
      activo: fila.activo,
    },
    negocio: {
      id: fila.negocio_id,
      nombre: fila.negocio_nombre,
      slug: fila.negocio_slug,
      plan: fila.plan,
      venceEn: fila.suscripcion_vence_en,
      tema: {
        acento: fila.color_acento,
        fondo: fila.color_fondo,
        logo: fila.logo_url,
      },
    },
  });
});

/**
 * PATCH /api/auth/password (autenticado, cualquier rol)
 * Cambia la contraseña propia verificando la actual.
 * Body: { actual, nueva }
 */
const cambiarPassword = asyncHandler(async (req, res) => {
  const actual = String(req.body.actual || '');
  const nueva = String(req.body.nueva || '');
  if (!actual || !nueva) throw new ApiError(400, 'Debes indicar la contraseña actual y la nueva.');
  if (nueva.length < 6) throw new ApiError(400, 'La nueva contraseña debe tener al menos 6 caracteres.');

  const { rows } = await query('SELECT password_hash FROM usuarios WHERE id = $1 AND negocio_id = $2', [
    req.usuario.id,
    req.negocioId,
  ]);
  if (!rows[0]) throw new ApiError(404, 'Usuario no encontrado.');
  const valida = await bcrypt.compare(actual, rows[0].password_hash);
  if (!valida) throw new ApiError(401, 'La contraseña actual no es correcta.');

  const hash = await bcrypt.hash(nueva, 10);
  await query('UPDATE usuarios SET password_hash = $1 WHERE id = $2 AND negocio_id = $3', [
    hash,
    req.usuario.id,
    req.negocioId,
  ]);
  res.json({ ok: true, mensaje: 'Contraseña actualizada.' });
});

/**
 * PATCH /api/auth/perfil (autenticado, cualquier rol)
 * Actualiza el nombre completo propio. Body: { nombreCompleto }
 */
const actualizarPerfil = asyncHandler(async (req, res) => {
  const nombreCompleto = String(req.body.nombreCompleto || '').trim();
  if (!nombreCompleto) throw new ApiError(400, 'El nombre no puede estar vacío.');
  const { rows } = await query(
    `UPDATE usuarios SET nombre_completo = $1 WHERE id = $2 AND negocio_id = $3
     RETURNING id, nombre_completo, username, rol`,
    [nombreCompleto, req.usuario.id, req.negocioId]
  );
  if (!rows[0]) throw new ApiError(404, 'Usuario no encontrado.');
  res.json({ ok: true, usuario: rows[0] });
});

module.exports = { login, me, resolverNegocio, cambiarPassword, actualizarPerfil };
