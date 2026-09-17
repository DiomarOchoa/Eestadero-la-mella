-- =========================================================
-- ESTADERO LA MELLA - Caja por turnos
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS caja_turnos (
    id                  SERIAL PRIMARY KEY,
    usuario_apertura_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    usuario_cierre_id   INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    monto_apertura      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_apertura >= 0),
    monto_esperado      NUMERIC(12,2),
    monto_contado       NUMERIC(12,2),
    diferencia           NUMERIC(12,2),
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

CREATE INDEX IF NOT EXISTS idx_caja_turnos_fecha_apertura
    ON caja_turnos (fecha_apertura);

CREATE INDEX IF NOT EXISTS idx_caja_turnos_fecha_cierre
    ON caja_turnos (fecha_cierre);

CREATE UNIQUE INDEX IF NOT EXISTS idx_caja_un_turno_abierto
    ON caja_turnos ((1))
    WHERE fecha_cierre IS NULL;

COMMIT;
