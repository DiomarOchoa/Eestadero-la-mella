# Paso 1 — Convertir La Mella en SaaS multi-negocio

## Orden de aplicación

1. **Respalda la base antes de nada**
   ```bash
   pg_dump estadero_la_mella > backup_pre_multitenant.sql
   ```
2. Copia `005_multi_tenant.sql` a `database/migrations/` y ejecútalo:
   ```bash
   psql -d estadero_la_mella -f database/migrations/005_multi_tenant.sql
   ```
3. Reemplaza `backend/src/middleware/auth.js` y `backend/src/controllers/authController.js`.
4. Reemplaza `backend/src/controllers/productosController.js` (es el patrón a copiar).
5. Replica el patrón en el resto de controladores (checklist abajo).
6. Borra `backend/src/routes/Ventas.js` — tiene estado en memoria (`let cajaAbierta`)
   que se rompe con más de una instancia del servidor y no está conectado a la DB.
7. Actualiza `server.js`: el bloque `esquemaBase` y la creación del admin inicial
   deben crear también el negocio y asociarle el usuario.

Después de la migración, todos los tokens JWT existentes quedan inválidos
(no traen `negocioId`). Eso es intencional: los usuarios vuelven a iniciar sesión.

## Checklist de archivos por migrar

| Archivo | Qué cambiar |
|---|---|
| `middleware/auth.js` | ✅ entregado |
| `controllers/authController.js` | ✅ entregado |
| `controllers/productosController.js` | ✅ entregado (patrón) |
| `controllers/clientesController.js` | `negocio_id` en `listar` (búsqueda) y en el `INSERT` de `crear` |
| `controllers/cuentasController.js` | el más delicado: `listar`, `obtener`, `abrir`, `agregarProducto`, `actualizarCantidad`, `eliminarProducto`, `cerrar`, `actualizar`. Ojo con la subconsulta de stock reservado y con el `SELECT ... FOR UPDATE` del turno de caja |
| `controllers/usuariosController.js` | filtrar listado, validar "último admin" **dentro del negocio**, y `restablecerDatos` debe borrar solo las filas de ese negocio (¡nunca `TRUNCATE`!) |
| `controllers/reportesController.js` | `negocio_id` en las 5 consultas |
| `routes/cajaroutes.js` | `negocio_id` en `actual`, `abrir`, `cerrar`, `historial` |

### ⚠️ Lo más peligroso de la lista

`usuariosController.restablecerDatos` hoy hace:

```sql
TRUNCATE TABLE detalle_cuenta, cuentas, caja_turnos, clientes, productos RESTART IDENTITY CASCADE
```

En multi-tenant eso **borraría los datos de todos tus clientes de un solo clic**.
Debe pasar a ser `DELETE ... WHERE negocio_id = $1` en el orden correcto
(detalle → cuentas → caja_turnos → clientes → productos), sin `RESTART IDENTITY`.

## Frontend: quitar el branding fijo

- `AuthContext` ya llama a `/auth/me`: ahora recibe `negocio.tema`. Aplica los
  colores con `document.documentElement.style.setProperty('--color-accent', ...)`.
- `Login.jsx`: el texto fijo "La Mella" pasa a ser el nombre del negocio resuelto
  por subdominio (o un selector si entran por el dominio raíz).
- `manifest.json`: hoy es estático. Para que cada local instale *su* PWA, sírvelo
  desde el backend: `GET /api/negocios/:slug/manifest.json`.

## Cómo verificar que no hay fugas entre negocios

Crea un segundo negocio de prueba y comprueba que:

1. Con el token del negocio A, `GET /api/productos` no devuelve nada del negocio B.
2. Con el token de A, `PATCH /api/productos/:id` sobre un id de B responde 404.
3. Abrir caja en A no bloquea abrir caja en B.
4. Puede existir un usuario `admin` en A y otro `admin` en B.
5. Cerrar una cuenta en A no descuenta stock de B.

Las FK compuestas de la migración son tu red de seguridad: si un controlador se
te olvida, Postgres rechaza la operación en vez de mezclar los datos.

## Siguiente paso (cuando esto esté verde)

Onboarding self-service: `POST /api/negocios` que cree negocio + primer admin +
productos base en una transacción. De ahí ya puedes enganchar el cobro
(Wompi o ePayco manejan Nequi y PSE) escribiendo `plan` y `suscripcion_vence_en`
desde el webhook de pago — el middleware `requerirSuscripcionActiva` ya está listo
para hacer cumplir el vencimiento.
