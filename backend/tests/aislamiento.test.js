/**
 * Tests de aislamiento multi-tenant contra Postgres real.
 * Requieren TEST_DATABASE_URL (los provee el CI con un servicio postgres).
 * Sin esa variable se omiten para no romper `npm test` en local.
 *
 * Cubre la red de seguridad de la migración multi-tenant:
 *  - username repetido entre negocios: permitido (único por negocio)
 *  - username repetido dentro del negocio: rechazado (23505)
 *  - cuenta de B con cliente de A: rechazada (FK compuesta)
 *  - caja abierta simultánea en A y B: permitida (único por negocio)
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const TEST_URL = process.env.TEST_DATABASE_URL;
const pg = TEST_URL ? require('pg') : null;

describe('aislamiento multi-tenant', { skip: !TEST_URL }, () => {
  let pool;
  let negA;
  let negB;

  before(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    const sufijo = Date.now().toString(36);
    const a = await pool.query(
      `INSERT INTO negocios (nombre, slug, plan) VALUES ($1, $2, 'PRO') RETURNING id`,
      [`Test A ${sufijo}`, `test-a-${sufijo}`]
    );
    const b = await pool.query(
      `INSERT INTO negocios (nombre, slug, plan) VALUES ($1, $2, 'PRO') RETURNING id`,
      [`Test B ${sufijo}`, `test-b-${sufijo}`]
    );
    negA = a.rows[0].id;
    negB = b.rows[0].id;
  });

  after(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM cuentas WHERE negocio_id = $1 OR negocio_id = $2', [negA, negB]);
    await pool.query('DELETE FROM caja_turnos WHERE negocio_id = $1 OR negocio_id = $2', [negA, negB]);
    await pool.query('DELETE FROM clientes WHERE negocio_id = $1 OR negocio_id = $2', [negA, negB]);
    await pool.query('DELETE FROM productos WHERE negocio_id = $1 OR negocio_id = $2', [negA, negB]);
    await pool.query('DELETE FROM usuarios WHERE negocio_id = $1 OR negocio_id = $2', [negA, negB]);
    await pool.query('DELETE FROM negocios WHERE id = $1 OR id = $2', [negA, negB]);
    await pool.end();
  });

  it('mismo username en dos negocios: permitido', async () => {
    await pool.query(
      `INSERT INTO usuarios (negocio_id, nombre_completo, username, password_hash, rol) VALUES ($1, 'A', 'mismo-user', 'x', 'ADMIN')`,
      [negA]
    );
    await pool.query(
      `INSERT INTO usuarios (negocio_id, nombre_completo, username, password_hash, rol) VALUES ($1, 'B', 'mismo-user', 'x', 'ADMIN')`,
      [negB]
    );
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM usuarios WHERE username = 'mismo-user'`);
    assert.equal(rows[0].n >= 2, true);
  });

  it('mismo username dentro del negocio: rechazado', async () => {
    await assert.rejects(
      pool.query(
        `INSERT INTO usuarios (negocio_id, nombre_completo, username, password_hash, rol) VALUES ($1, 'A2', 'mismo-user', 'x', 'EMPLEADO')`,
        [negA]
      ),
      /duplicate|23505/
    );
  });

  it('cuenta de B con cliente de A: rechazada por FK compuesta', async () => {
    const adminA = await pool.query('SELECT id FROM usuarios WHERE negocio_id = $1 LIMIT 1', [negA]);
    const cli = await pool.query(`INSERT INTO clientes (negocio_id, referencia) VALUES ($1, 'cli-a') RETURNING id`, [negA]);
    await assert.rejects(
      pool.query(
        `INSERT INTO cuentas (negocio_id, cliente_id, usuario_apertura_id) VALUES ($1, $2, $3)`,
        // usuario_apertura inexistente en B a propósito: la FK de cliente debe fallar primero/igual
        [negB, cli.rows[0].id, adminA.rows[0].id]
      ),
      /violates foreign key|23503/
    );
  });

  it('caja abierta simultanea en A y B: permitida', async () => {
    const adminA = await pool.query('SELECT id FROM usuarios WHERE negocio_id = $1 LIMIT 1', [negA]);
    const adminB = await pool.query('SELECT id FROM usuarios WHERE negocio_id = $1 LIMIT 1', [negB]);
    await pool.query('INSERT INTO caja_turnos (negocio_id, usuario_apertura_id, monto_apertura) VALUES ($1, $2, 0)', [negA, adminA.rows[0].id]);
    await pool.query('INSERT INTO caja_turnos (negocio_id, usuario_apertura_id, monto_apertura) VALUES ($1, $2, 0)', [negB, adminB.rows[0].id]);
    // Segunda caja en A: rechazada (una por negocio)
    await assert.rejects(
      pool.query('INSERT INTO caja_turnos (negocio_id, usuario_apertura_id, monto_apertura) VALUES ($1, $2, 0)', [negA, adminA.rows[0].id]),
      /duplicate|23505/
    );
  });
});
