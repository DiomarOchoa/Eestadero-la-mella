-- =========================================================
-- ESTADERO LA MELLA - Esquema de base de datos (PostgreSQL)
-- Sistema de cuentas abiertas por cliente
-- =========================================================

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

CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(120) NOT NULL,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol             rol_usuario NOT NULL DEFAULT 'EMPLEADO',
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios (rol);

CREATE TABLE IF NOT EXISTS clientes (
    id              SERIAL PRIMARY KEY,
    referencia      VARCHAR(100) NOT NULL,
    notas           VARCHAR(255),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_referencia_trgm ON clientes (LOWER(referencia));

CREATE TABLE IF NOT EXISTS productos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL,
    tipo            tipo_producto NOT NULL,
    precio          NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_minimo    INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_tipo ON productos (tipo);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos (activo);

CREATE TABLE IF NOT EXISTS caja_turnos (
    id                  SERIAL PRIMARY KEY,
    usuario_apertura_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    usuario_cierre_id   INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    monto_apertura      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_apertura >= 0),
    monto_esperado      NUMERIC(12,2),
    monto_contado       NUMERIC(12,2),
    diferencia          NUMERIC(12,2),
    total_ventas        NUMERIC(12,2) NOT NULL DEFAULT 0,
    ventas_realizadas   INTEGER NOT NULL DEFAULT 0,
    total_efectivo      NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_transferencia NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_tarjeta       NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_mixto         NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_apertura      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre        TIMESTAMPTZ,
    observaciones       VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_caja_turnos_fecha_apertura ON caja_turnos (fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_caja_turnos_fecha_cierre ON caja_turnos (fecha_cierre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_caja_un_turno_abierto
    ON caja_turnos ((1)) WHERE fecha_cierre IS NULL;

CREATE TABLE IF NOT EXISTS cuentas (
    id                    SERIAL PRIMARY KEY,
    cliente_id            INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    usuario_apertura_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    usuario_cierre_id     INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    caja_turno_id         INTEGER REFERENCES caja_turnos(id) ON DELETE RESTRICT,
    estado                estado_cuenta NOT NULL DEFAULT 'ABIERTA',
    total                 NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    metodo_pago           metodo_pago,
    monto_efectivo        NUMERIC(12,2),
    monto_transferencia   NUMERIC(12,2),
    para_llevar           BOOLEAN NOT NULL DEFAULT FALSE,
    observaciones         VARCHAR(255),
    fecha_apertura        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cuentas_estado ON cuentas (estado);
CREATE INDEX IF NOT EXISTS idx_cuentas_cliente ON cuentas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_fecha_apertura ON cuentas (fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_cuentas_estado_fecha ON cuentas (estado, fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_cuentas_para_llevar ON cuentas (para_llevar);
CREATE INDEX IF NOT EXISTS idx_cuentas_caja_turno ON cuentas (caja_turno_id);

CREATE TABLE IF NOT EXISTS detalle_cuenta (
    id                  SERIAL PRIMARY KEY,
    cuenta_id           INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
    producto_id         INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad            INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario     NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal            NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
