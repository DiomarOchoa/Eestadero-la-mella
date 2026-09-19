// backend/src/controllers/negociosController.js
// Registro público (self-service) de un negocio nuevo.
// Crea el negocio + su primer usuario ADMIN en una sola transacción y
// devuelve un token, para que quede con sesión iniciada de una vez.
//
// OJO: este endpoint NO requiere autenticación (es la puerta de entrada de
// clientes nuevos). No confundir con POST /api/usuarios, que crea usuarios
// DENTRO de un negocio ya existente y sí exige sesión de ADMIN.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getClient } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/** "Bar El Rincón" -> "bar-el-rincon" */
function generarSlugBase(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/** Encuentra un slug libre partiendo de una base (agrega -2, -3, ... si choca). */
async function resolverSlugDisponible(client, nombreNegocio, slugSugerido) {
  let base = generarSlugBase(slugSugerido || nombreNegocio);
  if (!base) base = 'negocio';
  if (base.length < 3) base = `neg-${base}`;
  if (!/^[a-z0-9]/.test(base)) base = `n${base}`;
  base = base.slice(0, 50);

  let slug = base;
  let sufijo = 1;
  for (let i = 0; i < 20; i++) {
    const { rows } = await client.query('SELECT 1 FROM negocios WHERE slug = $1', [slug]);
    if (!rows[0]) return slug;
    sufijo += 1;
    slug = `${base}-${sufijo}`.slice(0, 58);
  }
  throw new ApiError(409, 'No fue posible generar un identificador único para el negocio. Intenta con otro nombre.');
}

/**
 * POST /api/negocios
 * Body: { nombreNegocio, slug?, nombreCompleto, username, password }
 */
const crear = asyncHandler(async (req, res) => {
  const nombreNegocio = String(req.body.nombreNegocio || '').trim();
  const slugPropuesto = req.body.slug ? String(req.body.slug).trim().toLowerCase() : null;
  const nombreCompleto = String(req.body.nombreCompleto || '').trim();
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!nombreNegocio || nombreNegocio.length > 120) {
    throw new ApiError(400, 'El nombre del negocio es obligatorio (máximo 120 caracteres).');
  }
  if (!nombreCompleto) throw new ApiError(400, 'Tu nombre completo es obligatorio.');
  if (!username || username.length < 3 || username.length > 50) {
    throw new ApiError(400, 'El usuario debe tener entre 3 y 50 caracteres.');
  }
  if (!password || password.length < 6) {
    throw new ApiError(400, 'La contraseña debe tener al menos 6 caracteres.');
  }
  if (slugPropuesto && !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slugPropuesto)) {
    throw new ApiError(400, 'El identificador del negocio solo puede tener letras minúsculas, números y guiones.');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const slug = await resolverSlugDisponible(client, nombreNegocio, slugPropuesto);

    // Plan GRATIS por defecto: sin vencimiento, límite de 20 productos
    // (ver productosController.crear) — el gancho natural para el upsell.
    const { rows: negocioRows } = await client.query(
      `INSERT INTO negocios (nombre, slug, plan)
       VALUES ($1, $2, 'GRATIS')
       RETURNING id, nombre, slug, plan`,
      [nombreNegocio, slug]
    );
    const negocio = negocioRows[0];

    const passwordHash = await bcrypt.hash(password, 10);
    let usuario;
    try {
      const { rows: usuarioRows } = await client.query(
        `INSERT INTO usuarios (negocio_id, nombre_completo, username, password_hash, rol)
         VALUES ($1, $2, $3, $4, 'ADMIN')
         RETURNING id, nombre_completo, username, rol`,
        [negocio.id, nombreCompleto, username, passwordHash]
      );
      usuario = usuarioRows[0];
    } catch (err) {
      if (err.code === '23505') throw new ApiError(409, 'Ese nombre de usuario ya está en uso. Elige otro.');
      throw err;
    }

    await client.query('COMMIT');

    const token = jwt.sign(
      { id: usuario.id, username: usuario.username, rol: usuario.rol, negocioId: negocio.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.status(201).json({
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombre_completo,
        username: usuario.username,
        rol: usuario.rol,
      },
      negocio: { id: negocio.id, nombre: negocio.nombre, slug: negocio.slug, plan: negocio.plan },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { crear };
