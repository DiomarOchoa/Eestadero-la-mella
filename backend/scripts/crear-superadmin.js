/**
 * Crea o promueve un SUPERADMIN del SaaS.
 * Uso:
 *   node scripts/crear-superadmin.js <username> <password> [nombreCompleto]
 * El usuario queda en el negocio semilla con rol SUPERADMIN.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { SLUG_SEMILLA } = require('../src/utils/negocioSemilla');

async function run() {
  const username = String(process.argv[2] || '').trim().toLowerCase();
  const password = String(process.argv[3] || '');
  const nombreCompleto = String(process.argv[4] || 'Super Admin');
  if (!username || !password || password.length < 8) {
    console.error('Uso: node scripts/crear-superadmin.js <username> <password(8+)> [nombreCompleto]');
    process.exit(1);
  }
  const { rows: neg } = await pool.query('SELECT id, slug FROM negocios WHERE slug = $1 LIMIT 1', [SLUG_SEMILLA]);
  if (!neg[0]) {
    console.error(`No existe el negocio semilla ('${SLUG_SEMILLA}'). Levanta el servidor una vez para crearlo.`);
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (negocio_id, nombre_completo, username, password_hash, rol, activo)
     VALUES ($1, $2, $3, $4, 'SUPERADMIN', TRUE)
     ON CONFLICT DO NOTHING RETURNING id, username, rol`,
    [neg[0].id, nombreCompleto, username, hash]
  );
  if (!rows[0]) {
    await pool.query(`UPDATE usuarios SET password_hash = $1, rol = 'SUPERADMIN', activo = TRUE WHERE LOWER(username) = $2 AND negocio_id = $3`, [hash, username, neg[0].id]);
    console.log(`Usuario ${username} promovido a SUPERADMIN.`);
  } else {
    console.log(`SUPERADMIN creado: ${username}`);
  }
  await pool.end();
}

run().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
