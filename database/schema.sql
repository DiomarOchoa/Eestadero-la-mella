-- =========================================================
-- ESTADERO LA MELLA - Esquema de base de datos (PostgreSQL)
-- Sistema de cuentas abiertas por cliente
-- =========================================================

-- Extensión para generar UUIDs si se prefiere en el futuro (no usado por defecto,
-- se dejan IDs seriales por simplicidad y rendimiento en un negocio de este tamaño).
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- ---------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('ADMIN', 'EMPLEADO');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_producto AS ENUM ('CERVEZA', 'BEBIDA', 'SNACK');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_cuenta AS ENUM ('ABIERTA', 'CERRADA');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE metodo_pago AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MIXTO');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------
-- Tabla: usuarios
-- Usuarios del sistema (empleados/administradores del negocio)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(120)  NOT NULL,
    username        VARCHAR(50)   NOT NULL UNIQUE,
    password_hash   VARCHAR(255)  NOT NULL,
    rol             rol_usuario   NOT NULL DEFAULT 'EMPLEADO',
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios (rol);

-- ---------------------------------------------------------
-- Tabla: clientes
-- Clientes "ligeros": solo una referencia flexible (apodo, mesa, nombre)
-- No se exige documento ni datos formales, tal como opera el negocio real.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id              SERIAL PRIMARY KEY,
    referencia      VARCHAR(100)  NOT NULL,     -- ej: "Luis", "El flaco", "Mesa 2"
    notas           VARCHAR(255),
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índice para autocompletado / búsqueda rápida por referencia (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_clientes_referencia_trgm ON clientes (LOWER(referencia));

-- ---------------------------------------------------------
-- Tabla: productos
-- Catálogo de productos vendidos (cervezas, bebidas, snacks)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(120)    NOT NULL,
    tipo            tipo_producto   NOT NULL,
    precio          NUMERIC(10,2)   NOT NULL CHECK (precio >= 0),
    stock           INTEGER         NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_minimo    INTEGER         NOT NULL DEFAULT 5,
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_tipo ON productos (tipo);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos (activo);

-- ---------------------------------------------------------
-- Tabla: cuentas
-- Núcleo del sistema: cuentas abiertas/cerradas asociadas a un cliente
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuentas (
    id                  SERIAL PRIMARY KEY,
    cliente_id          INTEGER         NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    usuario_apertura_id INTEGER         NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    usuario_cierre_id   INTEGER         REFERENCES usuarios(id) ON DELETE RESTRICT,
    estado              estado_cuenta   NOT NULL DEFAULT 'ABIERTA',
    total               NUMERIC(12,2)   NOT NULL DEFAULT 0 CHECK (total >= 0),
    metodo_pago         metodo_pago,
    para_llevar         BOOLEAN         NOT NULL DEFAULT FALSE,
    observaciones       VARCHAR(255),
    fecha_apertura      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    fecha_cierre        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cuentas_estado ON cuentas (estado);
CREATE INDEX IF NOT EXISTS idx_cuentas_cliente ON cuentas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_fecha_apertura ON cuentas (fecha_apertura);
-- Consulta muy frecuente: "dame las cuentas abiertas ordenadas por apertura"
CREATE INDEX IF NOT EXISTS idx_cuentas_estado_fecha ON cuentas (estado, fecha_apertura);
CREATE INDEX IF NOT EXISTS idx_cuentas_para_llevar ON cuentas (para_llevar);

-- ---------------------------------------------------------
-- Tabla: detalle_cuenta
-- Renglones de productos dentro de cada cuenta
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_cuenta (
    id                  SERIAL PRIMARY KEY,
    cuenta_id           INTEGER         NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
    producto_id         INTEGER         NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad            INTEGER         NOT NULL CHECK (cantidad > 0),
    precio_unitario     NUMERIC(10,2)   NOT NULL CHECK (precio_unitario >= 0),
    subtotal            NUMERIC(12,2)   GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    creado_en           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detalle_cuenta_cuenta ON detalle_cuenta (cuenta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_cuenta_producto ON detalle_cuenta (producto_id);

-- ---------------------------------------------------------
-- Función + Trigger: recalcular total de la cuenta automáticamente
-- cada vez que se inserta, actualiza o elimina un renglón del detalle.
-- Esto garantiza que "total" en cuentas SIEMPRE sea consistente con el detalle,
-- sin depender de que el backend lo calcule manualmente.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_recalcular_total_cuenta()
RETURNS TRIGGER AS $$
DECLARE
    v_cuenta_id INTEGER;
BEGIN
    v_cuenta_id := COALESCE(NEW.cuenta_id, OLD.cuenta_id);

    UPDATE cuentas
    SET total = COALESCE((
        SELECT SUM(subtotal) FROM detalle_cuenta WHERE cuenta_id = v_cuenta_id
    ), 0)
    WHERE id = v_cuenta_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_detalle_insert ON detalle_cuenta;
CREATE TRIGGER trg_detalle_insert
AFTER INSERT ON detalle_cuenta
FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total_cuenta();

DROP TRIGGER IF EXISTS trg_detalle_update ON detalle_cuenta;
CREATE TRIGGER trg_detalle_update
AFTER UPDATE ON detalle_cuenta
FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total_cuenta();

DROP TRIGGER IF EXISTS trg_detalle_delete ON detalle_cuenta;
CREATE TRIGGER trg_detalle_delete
AFTER DELETE ON detalle_cuenta
FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total_cuenta();

-- ---------------------------------------------------------
-- Trigger genérico para mantener actualizado_en en usuarios/productos
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_actualizado ON usuarios;
CREATE TRIGGER trg_usuarios_actualizado
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

DROP TRIGGER IF EXISTS trg_productos_actualizado ON productos;
CREATE TRIGGER trg_productos_actualizado
BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMIT;
