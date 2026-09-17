-- =========================================================
-- ESTADERO LA MELLA - Vincular cuentas cerradas con turno de caja
-- =========================================================

BEGIN;

ALTER TABLE cuentas
ADD COLUMN IF NOT EXISTS caja_turno_id INTEGER REFERENCES caja_turnos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cuentas_caja_turno
    ON cuentas (caja_turno_id);

COMMIT;
