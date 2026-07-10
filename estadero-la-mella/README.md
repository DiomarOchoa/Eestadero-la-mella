# 🍺 Estadero La Mella — Sistema de Cuentas Abiertas

Sistema web privado para la gestión de ventas de un estadero real, basado en
**cuentas abiertas por cliente** (no es un POS tradicional de venta inmediata).

Los clientes se identifican con referencias flexibles ("Luis", "El flaco",
"Casco negro", "Mesa 2"), consumen productos durante la jornada y pagan al
cerrar la cuenta.

---

## 1. Arquitectura general

```
estadero-la-mella/
├── database/           # Esquema SQL y datos semilla (PostgreSQL)
│   ├── schema.sql
│   └── seed.sql
├── backend/             # API REST (Node.js + Express)
│   └── src/
│       ├── config/      # Conexión a PostgreSQL (pool)
│       ├── middleware/   # auth (JWT/roles), validate, errorHandler
│       ├── controllers/  # Lógica de negocio por módulo
│       ├── routes/       # Definición de endpoints
│       ├── utils/        # ApiError, asyncHandler, seedAdmin
│       ├── app.js        # Configuración de Express y montaje de rutas
│       └── server.js     # Punto de entrada
└── frontend/            # SPA (React + Vite)
    └── src/
        ├── api/          # Cliente HTTP centralizado
        ├── context/      # AuthContext (sesión, JWT)
        ├── components/   # Navbar, ProtectedRoute
        ├── pages/        # Login, Dashboard, Cuentas, Inventario, Reportes, Usuarios
        └── styles/       # Design tokens + componentes visuales
```

**Separación por capas en el backend** (arquitectura limpia):
`routes` (qué endpoint existe) → `middleware` (seguridad/validación) →
`controllers` (lógica de negocio y acceso a datos vía SQL parametrizado).

---

## 2. Base de datos (PostgreSQL)

Tablas principales: `usuarios`, `clientes`, `productos`, `cuentas`, `detalle_cuenta`.

Puntos destacados del diseño (ver `database/schema.sql`):

- **Tipos ENUM** (`rol_usuario`, `tipo_producto`, `estado_cuenta`, `metodo_pago`)
  en lugar de strings libres, para integridad de datos.
- **Claves foráneas** con `ON DELETE RESTRICT` (no se puede borrar un producto
  o cliente con historial asociado) y `ON DELETE CASCADE` en `detalle_cuenta`
  (si se elimina una cuenta, se elimina su detalle).
- **Columna generada** `subtotal` en `detalle_cuenta` (`cantidad * precio_unitario`),
  calculada siempre por la base de datos, nunca por la aplicación.
- **Trigger `fn_recalcular_total_cuenta`**: recalcula automáticamente
  `cuentas.total` cada vez que se inserta, actualiza o elimina un renglón de
  `detalle_cuenta`. Esto evita inconsistencias entre el total mostrado y el
  detalle real.
- **Índices** en columnas de filtro/orden frecuente: `cuentas(estado)`,
  `cuentas(estado, fecha_apertura)` (para el listado de cuentas abiertas),
  `productos(tipo)`, `detalle_cuenta(cuenta_id)`.
- **Precio histórico**: al agregar un producto a una cuenta, se copia el precio
  vigente a `detalle_cuenta.precio_unitario`. Si el precio del producto cambia
  después, las cuentas ya abiertas no se ven afectadas.

### Ejecutar el esquema

```bash
createdb estadero_la_mella
psql -d estadero_la_mella -f database/schema.sql
psql -d estadero_la_mella -f database/seed.sql   # productos y clientes de ejemplo
```

---

## 3. Backend (API REST)

### Requisitos
- Node.js 18+
- PostgreSQL 14+

### Instalación

```bash
cd backend
npm install
cp .env.example .env
# Edita .env con los datos de tu PostgreSQL local
```

### Crear el usuario administrador inicial

El hash de `seed.sql` es solo ilustrativo. Genera el usuario admin real con:

```bash
npm run seed:admin
# Crea admin / admin123 por defecto.
# También puedes personalizar:
node src/utils/seedAdmin.js miusuario miclave123 "Nombre Completo"
```

### Levantar el servidor

```bash
npm run dev     # con nodemon (desarrollo)
npm start       # producción
```

La API queda disponible en `http://localhost:4000/api` (configurable por `PORT`).

### Endpoints principales

| Método | Ruta                                   | Descripción                                  | Rol requerido |
|--------|-----------------------------------------|-----------------------------------------------|----------------|
| POST   | `/api/auth/login`                       | Inicia sesión, devuelve JWT                   | público        |
| GET    | `/api/auth/me`                          | Usuario autenticado actual                    | autenticado    |
| GET    | `/api/usuarios`                         | Listar usuarios                               | ADMIN          |
| POST   | `/api/usuarios`                         | Crear usuario                                 | ADMIN          |
| PATCH  | `/api/usuarios/:id`                     | Editar usuario (rol, activo, password)        | ADMIN          |
| GET    | `/api/productos`                        | Listar/filtrar productos                      | autenticado    |
| POST   | `/api/productos`                        | Crear producto                                | ADMIN          |
| PATCH  | `/api/productos/:id`                    | Editar producto / stock                       | ADMIN          |
| GET    | `/api/productos/inventario/bajo-stock`  | Productos bajo el stock mínimo                | autenticado    |
| GET    | `/api/clientes?q=`                      | Buscar clientes (autocompletado)              | autenticado    |
| POST   | `/api/clientes`                         | Crear referencia de cliente                   | autenticado    |
| GET    | `/api/cuentas?estado=ABIERTA`           | Listar cuentas por estado                     | autenticado    |
| GET    | `/api/cuentas/:id`                      | Detalle de una cuenta (con productos)         | autenticado    |
| POST   | `/api/cuentas`                          | Abrir cuenta nueva                            | autenticado    |
| POST   | `/api/cuentas/:id/productos`            | Agregar producto a la cuenta                  | autenticado    |
| PATCH  | `/api/cuentas/:id/productos/:itemId`    | Cambiar cantidad de un renglón                | autenticado    |
| DELETE | `/api/cuentas/:id/productos/:itemId`    | Quitar un renglón de la cuenta                | autenticado    |
| POST   | `/api/cuentas/:id/cerrar`               | Cerrar cuenta, registra pago y descuenta stock| autenticado    |
| GET    | `/api/reportes/resumen`                 | KPIs del dashboard                            | autenticado    |
| GET    | `/api/reportes/ventas-por-dia`          | Ventas agrupadas por día                      | autenticado    |
| GET    | `/api/reportes/productos-mas-vendidos`  | Ranking de productos                          | autenticado    |

### Cierre de cuenta: transacción segura

`POST /api/cuentas/:id/cerrar` ejecuta, dentro de una transacción SQL:
1. Bloquea la fila de la cuenta (`FOR UPDATE`) para evitar cierres concurrentes.
2. Verifica stock disponible de cada producto del detalle.
3. Descuenta el stock producto por producto.
4. Marca la cuenta como `CERRADA`, guarda método de pago y usuario que cierra.

Si cualquier paso falla (ej. stock insuficiente), se hace `ROLLBACK` completo:
no queda ni el descuento de inventario ni el cierre a medias.

---

## 4. Frontend (React + Vite)

### Instalación

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL debe apuntar al backend, ej: http://localhost:4000/api
npm run dev
```

La aplicación queda en `http://localhost:5173`.

### Pantallas

- **Login** — autenticación obligatoria, sin acceso público a ninguna otra ruta.
- **Dashboard** — cuentas abiertas, ventas del día, alertas de stock (refresco automático).
- **Cuentas abiertas** — vista tipo "tickets de barra", refresco cada 10s.
- **Abrir cuenta** — referencia libre del cliente con autocompletado contra clientes existentes.
- **Vista de cuenta** — catálogo rápido para agregar productos, control de cantidades,
  total en tiempo real, y cierre de cuenta con selección de método de pago.
- **Inventario** — listado y edición de productos, alerta visual de stock bajo.
- **Reportes** — ventas por día (barras) y productos más vendidos.
- **Usuarios** — solo visible para ADMIN, creación y activación/desactivación.

### Identidad visual

El diseño se aleja del look genérico de dashboard SaaS y se inspira en la
estética real de un estadero nocturno de barrio: verde botella oscuro de
fondo, acentos ámbar tipo letrero de neón y tipografía condensada (`Anton`)
para títulos, con un elemento distintivo: las cuentas se muestran como
**tiquetes de barra** con borde perforado, replicando un tab de consumo físico.

---

## 5. Seguridad implementada

- Login obligatorio en toda ruta protegida (`ProtectedRoute` en frontend,
  middleware `autenticar` en backend).
- Contraseñas hasheadas con **bcrypt** (nunca se guardan en texto plano).
- Sesión manejada con **JWT** firmado (`JWT_SECRET`), expiración configurable.
- Roles `ADMIN` / `EMPLEADO` verificados en el backend con middleware
  `autorizar(...)` — el frontend solo oculta la UI, la autorización real
  vive en el servidor.
- Toda consulta SQL usa **parámetros** (`$1, $2, ...`), nunca concatenación
  de strings — previene inyección SQL.
- Manejo de errores centralizado que traduce errores de PostgreSQL
  (llave foránea, unicidad, checks) en respuestas HTTP claras sin filtrar
  detalles internos del stack.

---

## 6. Buenas prácticas aplicadas

- **Arquitectura en capas** (routes → middleware → controllers → DB) tanto en
  backend como una separación clara de responsabilidades en frontend
  (api / context / components / pages).
- **Transacciones explícitas** para operaciones críticas (abrir cuenta con
  cliente nuevo, cierre de cuenta con descuento de inventario).
- **Triggers de base de datos** para mantener la integridad del total de la
  cuenta, en lugar de confiar únicamente en el cálculo del backend.
- **Validación de entrada** con `express-validator` en rutas sensibles
  (login, creación de usuarios/productos).
- **Manejo de errores centralizado** (`errorHandler.js`) y `asyncHandler`
  para no repetir try/catch en cada controlador.
- **Precio histórico** en el detalle de cuenta, evitando que un cambio de
  precio afecte cuentas ya abiertas.
- **Variables de entorno** (`.env`) para credenciales y configuración,
  nunca hardcodeadas en el código.

---

## 7. Flujo típico de uso

1. El empleado inicia sesión.
2. Llega un cliente → **Abrir cuenta** → escribe "Casco negro" (o lo
   selecciona si ya existe) → la cuenta queda abierta.
3. Durante la noche, el empleado entra a la cuenta y agrega cervezas,
   bebidas o snacks con un clic; el total se actualiza al instante.
4. Al final, el cliente paga → el empleado abre la cuenta, pulsa
   **Cerrar cuenta**, selecciona el método de pago y confirma. El sistema
   descuenta automáticamente el inventario vendido.
5. El administrador revisa **Reportes** para ver ventas por día y los
   productos más vendidos, y **Inventario** para reabastecer lo necesario.
