/**
 * Script utilitario: crea (o actualiza la contraseña de) el usuario admin
 * inicial usando un hash bcrypt generado en tiempo de ejecución.
 *
 * Versión multi-tenant: el admin queda en el negocio 'lamella' y el
 * username es único global (ver negociosController/usuariosController).
 *
 * Uso:
 *   node src/utils/seedAdmin.js
 *   node src/utils/seedAdmin.js miusuario miclave "Nombre Completo"
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function run() {
  const username = String(process.argv[2] || 'admin').trim().toLowerCase();
  const password = String(process.argv[3] || 'admin123');
  const nombreCompleto = String(process.argv[4] || 'Administrador Principal');

  if (password.length < 6) {
    console.error('La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }

  const { rows: neg } = await pool.query(`SELECT id FROM negocios WHERE slug = 'lamella' LIMIT 1`);
  if (!neg[0]) {
    console.error("No existe el negocio 'lamella'. Levanta el servidor una vez para crearlo.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existente = await pool.query('SELECT id FROM usuarios WHERE LOWER(username) = $1 LIMIT 1', [username]);
  let result;
  if (existente.rows[0]) {
    result = await pool.query(
      `UPDATE usuarios SET password_hash = $1, activo = TRUE, nombre_completo = $2
       WHERE LOWER(username) = $3
       RETURNING id, username, rol`,
      [passwordHash, nombreCompleto, username]
    );
  } else {
    result = await pool.query(
      `INSERT INTO usuarios (negocio_id, nombre_completo, username, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, 'ADMIN', TRUE)
       RETURNING id, username, rol`,
      [neg[0].id, nombreCompleto, username, passwordHash]
    );
  }

  console.log('Usuario admin listo:', result.rows[0]);
  console.log(`Credenciales -> usuario: ${username} | clave: ${password}`);
  await pool.end();
}

run().catch((err) => {
  console.error('Error creando usuario admin:', err);
  process.exit(1);
});
