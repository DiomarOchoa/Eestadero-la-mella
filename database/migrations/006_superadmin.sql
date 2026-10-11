-- 006_superadmin.sql
-- Agrega rol SUPERADMIN para el dueño del SaaS (panel global).
-- Idempotente: puede ejecutarse varias veces.
DO $$ BEGIN
  ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'SUPERADMIN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
