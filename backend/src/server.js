const app = require('./app');
const { query } = require('./config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

const esquemaBase = `
BEGIN;

DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('ADMIN', 'EMPLEADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_producto AS ENUM ('CERVEZA', 'BEBIDA', 'SNACK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_cuenta AS ENUM ('ABIERTA', 'CERRADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE metodo_pago AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MIXTO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabla de negocios (multi-tenant). Se crea ANTES que las demás porque
-- usuarios/clientes/productos/cuentas/caja_turnos la referencian.
CREATE TABLE IF NOT EXISTS negocios (
    id                   SERIAL PRIMARY KEY,
    nombre               VARCHAR(120) NOT NULL,
    slug                 VARCHAR(60)  NOT NULL UNIQUE
                         CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
    plan                 VARCHAR(20)  NOT NULL DEFAULT 'BASICO'
                         CHECK (plan IN ('GRATIS', 'BASICO', 'PRO')),
    activo               BOOLEAN      NOT NULL DEFAULT TRUE,
    suscripcion_vence_en DATE,
    color_acento         VARCHAR(9),
    color_fondo          VARCHAR(9),
    logo_url             VARCHAR(300),
    creado_en            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(120) NOT NULL,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol rol_usuario NOT NULL DEFAULT 'EMPLEADO',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios (rol);

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    referencia VARCHAR(100) NOT NULL,
    notas VARCHAR(255),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_referencia_trgm ON clientes (LOWER(referencia));

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    tipo tipo_producto NOT NULL,
    precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_minimo INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_tipo ON productos (tipo);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos (activo);

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
);

CREATE INDEX IF NOT EXISTS idx_caja_turnos_fecha_apertura ON caja_turnos (fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_caja_turnos_fecha_cierre ON caja_turnos (fecha_cierre);

CREATE TABLE IF NOT EXISTS cuentas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    usuario_apertura_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    usuario_cierre_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    caja_turno_id INTEGER REFERENCES caja_turnos(id) ON DELETE RESTRICT,
    estado estado_cuenta NOT NULL DEFAULT 'ABIERTA',
    total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    metodo_pago metodo_pago,
    monto_efectivo NUMERIC(12,2),
    monto_transferencia NUMERIC(12,2),
    para_llevar BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones VARCHAR(255),
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cuentas_estado ON cuentas (estado);
CREATE INDEX IF NOT EXISTS idx_cuentas_cliente ON cuentas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_fecha_apertura ON cuentas (fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_cuentas_estado_fecha ON cuentas (estado, fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_cuentas_para_llevar ON cuentas (para_llevar);

CREATE TABLE IF NOT EXISTS detalle_cuenta (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detalle_cuenta_cuenta ON detalle_cuenta (cuenta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_cuenta_producto ON detalle_cuenta (producto_id);

CREATE OR REPLACE FUNCTION fn_recalcular_total_cuenta()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_id INTEGER;
BEGIN
    v_cuenta_id := COALESCE(NEW.cuenta_id, OLD.cuenta_id);
    UPDATE cuentas
    SET total = COALESCE((SELECT SUM(subtotal) FROM detalle_cuenta WHERE cuenta_id = v_cuenta_id), 0)
    WHERE id = v_cuenta_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_detalle_insert ON detalle_cuenta;
CREATE TRIGGER trg_detalle_insert AFTER INSERT ON detalle_cuenta FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total_cuenta();
DROP TRIGGER IF EXISTS trg_detalle_update ON detalle_cuenta;
CREATE TRIGGER trg_detalle_update AFTER UPDATE ON detalle_cuenta FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total_cuenta();
DROP TRIGGER IF EXISTS trg_detalle_delete ON detalle_cuenta;
CREATE TRIGGER trg_detalle_delete AFTER DELETE ON detalle_cuenta FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total_cuenta();

CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_actualizado ON usuarios;
CREATE TRIGGER trg_usuarios_actualizado BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();
DROP TRIGGER IF EXISTS trg_productos_actualizado ON productos;
CREATE TRIGGER trg_productos_actualizado BEFORE UPDATE ON productos FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMIT;
`;

/**
 * Aplica la estructura multi-tenant (equivalente a la migración 005) de forma
 * idempotente. Necesario para que un despliegue en una base COMPLETAMENTE
 * VACÍA quede en el mismo estado final que una base vieja + migración 005
 * aplicada a mano. Sin esto, un servidor nuevo fallaría porque negocio_id
 * es NOT NULL pero nunca se crea ni se llena.
 */
async function prepararMultiTenant() {
  // Negocio semilla: todo lo que exista sin negocio_id quedará aquí.
  await query(`
    INSERT INTO negocios (nombre, slug, plan)
    VALUES ('Estadero La Mella', 'lamella', 'PRO')
    ON CONFLICT (slug) DO NOTHING
  `);

  await query(`ALTER TABLE usuarios     ADD COLUMN IF NOT EXISTS negocio_id INTEGER REFERENCES negocios(id) ON DELETE RESTRICT`);
  await query(`ALTER TABLE clientes     ADD COLUMN IF NOT EXISTS negocio_id INTEGER REFERENCES negocios(id) ON DELETE RESTRICT`);
  await query(`ALTER TABLE productos    ADD COLUMN IF NOT EXISTS negocio_id INTEGER REFERENCES negocios(id) ON DELETE RESTRICT`);
  await query(`ALTER TABLE cuentas      ADD COLUMN IF NOT EXISTS negocio_id INTEGER REFERENCES negocios(id) ON DELETE RESTRICT`);
  await query(`ALTER TABLE caja_turnos  ADD COLUMN IF NOT EXISTS negocio_id INTEGER REFERENCES negocios(id) ON DELETE RESTRICT`);

  await query(`
    DO $$
    DECLARE
        v_negocio_id INTEGER;
    BEGIN
        SELECT id INTO v_negocio_id FROM negocios WHERE slug = 'lamella';

        UPDATE usuarios    SET negocio_id = v_negocio_id WHERE negocio_id IS NULL;
        UPDATE clientes    SET negocio_id = v_negocio_id WHERE negocio_id IS NULL;
        UPDATE productos   SET negocio_id = v_negocio_id WHERE negocio_id IS NULL;
        UPDATE cuentas     SET negocio_id = v_negocio_id WHERE negocio_id IS NULL;
        UPDATE caja_turnos SET negocio_id = v_negocio_id WHERE negocio_id IS NULL;
    END $$
  `);

  await query(`ALTER TABLE usuarios    ALTER COLUMN negocio_id SET NOT NULL`);
  await query(`ALTER TABLE clientes    ALTER COLUMN negocio_id SET NOT NULL`);
  await query(`ALTER TABLE productos   ALTER COLUMN negocio_id SET NOT NULL`);
  await query(`ALTER TABLE cuentas     ALTER COLUMN negocio_id SET NOT NULL`);
  await query(`ALTER TABLE caja_turnos ALTER COLUMN negocio_id SET NOT NULL`);

  await query(`ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_username_key`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username_negocio ON usuarios (negocio_id, LOWER(username))`);

  await query(`DROP INDEX IF EXISTS idx_caja_un_turno_abierto`);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_caja_un_turno_abierto_negocio
    ON caja_turnos (negocio_id)
    WHERE fecha_cierre IS NULL
  `);

  // Soltar primero las FKs dependientes de cuentas antes de tocar los
  // constraints únicos base (mismo orden que la migración 005 corregida).
  await query(`ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS cuentas_cliente_negocio_fk`);
  await query(`ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS cuentas_apertura_negocio_fk`);
  await query(`ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS cuentas_caja_turno_negocio_fk`);

  await query(`ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_id_negocio_key`);
  await query(`ALTER TABLE clientes ADD  CONSTRAINT clientes_id_negocio_key UNIQUE (id, negocio_id)`);

  await query(`ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_id_negocio_key`);
  await query(`ALTER TABLE usuarios ADD  CONSTRAINT usuarios_id_negocio_key UNIQUE (id, negocio_id)`);

  await query(`ALTER TABLE caja_turnos DROP CONSTRAINT IF EXISTS caja_turnos_id_negocio_key`);
  await query(`ALTER TABLE caja_turnos ADD  CONSTRAINT caja_turnos_id_negocio_key UNIQUE (id, negocio_id)`);

  await query(`
    ALTER TABLE cuentas ADD CONSTRAINT cuentas_cliente_negocio_fk
    FOREIGN KEY (cliente_id, negocio_id) REFERENCES clientes (id, negocio_id)
  `);
  await query(`
    ALTER TABLE cuentas ADD CONSTRAINT cuentas_apertura_negocio_fk
    FOREIGN KEY (usuario_apertura_id, negocio_id) REFERENCES usuarios (id, negocio_id)
  `);
  await query(`
    ALTER TABLE cuentas ADD CONSTRAINT cuentas_caja_turno_negocio_fk
    FOREIGN KEY (caja_turno_id, negocio_id) REFERENCES caja_turnos (id, negocio_id)
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_usuarios_negocio         ON usuarios (negocio_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clientes_negocio         ON clientes (negocio_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_productos_negocio_tipo   ON productos (negocio_id, tipo)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_productos_negocio_activo ON productos (negocio_id, activo)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cuentas_negocio_estado   ON cuentas (negocio_id, estado, fecha_apertura)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_cuentas_negocio_cierre   ON cuentas (negocio_id, fecha_cierre)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_caja_turnos_negocio      ON caja_turnos (negocio_id, fecha_apertura)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clientes_negocio_referencia ON clientes (negocio_id, LOWER(referencia))`);

  console.log('✅ Estructura multi-tenant verificada.');
}

async function prepararBaseDeDatos() {
  await query(esquemaBase);
  await query(`ALTER TYPE estado_cuenta ADD VALUE IF NOT EXISTS 'CANCELADA'`);
  console.log('✅ Esquema base verificado.');

  await prepararMultiTenant();

  await query(`
    ALTER TABLE cuentas
    ADD COLUMN IF NOT EXISTS caja_turno_id INTEGER REFERENCES caja_turnos(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS monto_efectivo NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS monto_transferencia NUMERIC(12,2)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_cuentas_caja_turno
    ON cuentas (caja_turno_id)
  `);

  console.log('✅ Estructura de caja verificada.');

  const resultadoUsuarios = await query('SELECT COUNT(*)::INTEGER AS cantidad FROM usuarios');

  if (resultadoUsuarios.rows[0].cantidad === 0) {
    const username = process.env.INITIAL_ADMIN_USERNAME || 'admin';
    const password = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);

    // El admin inicial debe quedar asociado al negocio semilla ('lamella'),
    // que ya existe gracias a prepararMultiTenant(). negocio_id es NOT NULL,
    // así que este INSERT fallaría sin resolverlo primero.
    const { rows: negocioRows } = await query(
      `SELECT id FROM negocios WHERE slug = 'lamella'`
    );
    const negocioId = negocioRows[0].id;

    await query(
      `INSERT INTO usuarios (negocio_id, nombre_completo, username, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, 'ADMIN', TRUE)`,
      [negocioId, 'Administrador', username, passwordHash]
    );

    console.log(`✅ Usuario administrador inicial creado: ${username}`);
    console.log('⚠️ Cambia la contraseña del administrador después de entrar.');
  } else {
    console.log('✅ Ya existen usuarios. No se creó un administrador nuevo.');
  }
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
