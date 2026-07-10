/**
 * Script utilitario: crea (o actualiza la contraseña de) el usuario admin
 * inicial usando un hash bcrypt generado en tiempo de ejecución.
 *
 * Uso:
 *   node src/utils/seedAdmin.js
 *   node src/utils/seedAdmin.js miusuario miclave "Nombre Completo"
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function run() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const nombreCompleto = process.argv[4] || 'Administrador Principal';

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO usuarios (nombre_completo, username, password_hash, rol, activo)
     VALUES ($1, $2, $3, 'ADMIN', TRUE)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, activo = TRUE
     RETURNING id, username, rol`,
    [nombreCompleto, username, passwordHash]
  );

  console.log('Usuario admin listo:', result.rows[0]);
  console.log(`Credenciales -> usuario: ${username} | clave: ${password}`);
  await pool.end();
}

run().catch((err) => {
  console.error('Error creando usuario admin:', err);
  process.exit(1);
});
