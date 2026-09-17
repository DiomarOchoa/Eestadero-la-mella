const app = require('./app');
const { query } = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

async function prepararBaseDeDatos() {
  await query(`
    CREATE TABLE IF NOT EXISTS caja_turnos (
      id SERIAL PRIMARY KEY,
      usuario_apertura_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      usuario_cierre_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
      monto_apertura NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_apertura >= 0),
      monto_esperado NUMERIC(12,2),
      monto_contado NUMERIC(12,2),
      diferencia NUMERIC(12,2),
      total_ventas NUMERIC(12,2) NOT NULL DEFAULT 0,
      ventas_realizadas INTEGER NOT NULL DEFAULT 0,
      total_efectivo NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_transferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_tarjeta NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_mixto NUMERIC(12,2) NOT NULL DEFAULT 0,
      fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fecha_cierre TIMESTAMPTZ,
      observaciones VARCHAR(500)
    )
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_caja_un_turno_abierto
    ON caja_turnos ((1))
    WHERE fecha_cierre IS NULL
  `);

  await query(`
    ALTER TABLE cuentas
    ADD COLUMN IF NOT EXISTS caja_turno_id INTEGER REFERENCES caja_turnos(id) ON DELETE RESTRICT
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_cuentas_caja_turno
    ON cuentas (caja_turno_id)
  `);

  console.log('✅ Estructura de caja verificada.');
}

prepararBaseDeDatos()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🍻 Estadero La Mella API corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ No fue posible preparar la base de datos:', err.message);
    process.exit(1);
  });
