-- =========================================================
-- ESTADERO LA MELLA - Datos semilla (seed)
-- =========================================================
-- El hash de abajo corresponde a la contraseña: "admin123"
-- Generado con bcrypt (10 rounds). Cámbiala en producción.
-- =========================================================

BEGIN;

INSERT INTO usuarios (nombre_completo, username, password_hash, rol)
VALUES
    ('Administrador Principal', 'admin', '$2b$10$9nqjb2b2vXO1xNu2mS5N9OJ6l2b1Fq8wq6d7pQyq0v2yq0v2yq0v2', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

-- NOTA IMPORTANTE:
-- El hash de ejemplo arriba es solo ilustrativo y puede no ser válido.
-- Al levantar el backend por primera vez, ejecuta el script:
--   node src/utils/seedAdmin.js
-- Este genera el hash real con bcryptjs para el usuario admin/admin123.

INSERT INTO productos (nombre, tipo, precio, stock, stock_minimo) VALUES
    ('Cerveza Águila Botella',    'CERVEZA', 4500,  120, 24),
    ('Cerveza Poker Botella',     'CERVEZA', 4500,  100, 24),
    ('Cerveza Club Colombia Lata','CERVEZA', 5000,  80,  24),
    ('Cerveza Corona Botella',    'CERVEZA', 7000,  60,  12),
    ('Pony Malta',                'BEBIDA',  3500,  50,  12),
    ('Hit Mora',                  'BEBIDA',  3000,  50,  12),
    ('Agua Cristal 600ml',        'BEBIDA',  2500,  60,  12),
    ('Chitos',                    'SNACK',   2000,  40,  10),
    ('Mekatos',                   'SNACK',   2000,  40,  10),
    ('Papas Margarita',           'SNACK',   3000,  30,  10)
ON CONFLICT DO NOTHING;

INSERT INTO clientes (referencia, notas) VALUES
    ('Luis', NULL),
    ('El flaco', NULL),
    ('Casco negro', 'Cliente frecuente, llega en moto'),
    ('Mesa 2', 'Referencia de ubicación, no persona fija')
ON CONFLICT DO NOTHING;

COMMIT;
