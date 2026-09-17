BEGIN;

ALTER TABLE cuentas
ADD COLUMN IF NOT EXISTS monto_efectivo NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS monto_transferencia NUMERIC(12,2);

ALTER TABLE cuentas
ADD CONSTRAINT cuentas_montos_mixto_check
CHECK (
  (metodo_pago = 'MIXTO' AND monto_efectivo IS NOT NULL AND monto_transferencia IS NOT NULL
    AND monto_efectivo >= 0 AND monto_transferencia >= 0
    AND monto_efectivo + monto_transferencia = total)
  OR
  (metodo_pago <> 'MIXTO' AND monto_efectivo IS NULL AND monto_transferencia IS NULL)
  OR metodo_pago IS NULL
);

COMMIT;
