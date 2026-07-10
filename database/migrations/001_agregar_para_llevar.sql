-- Migración: agrega la marca "para llevar" a las cuentas.
-- Segura de correr más de una vez (IF NOT EXISTS).

ALTER TABLE cuentas
    ADD COLUMN IF NOT EXISTS para_llevar BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cuentas_para_llevar ON cuentas (para_llevar);
