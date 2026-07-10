const express = require('express');
const cors = require('cors');
require('dotenv').config();
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const productosRoutes = require('./routes/productosRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const cuentasRoutes = require('./routes/cuentasRoutes');
const reportesRoutes = require('./routes/reportesRoutes');

const app = express();

// FRONTEND_URL admite una o varias URLs separadas por coma, ej:
// FRONTEND_URL=http://localhost:5173,http://192.168.1.9:5173
// Esto permite usar el sistema desde el PC (localhost) y desde el
// celular en la misma red (IP local) al mismo tiempo.
const origenesPermitidos = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Sin "origin" (ej: Postman, curl, healthchecks) -> permitir
      if (!origin || origenesPermitidos.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

// Healthcheck simple
app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'Estadero La Mella API', hora: new Date().toISOString() });
});

// Ruta temporal de diagnóstico - BORRAR después de confirmar el problema
app.get('/api/debug-env', (req, res) => {
  res.json({
    FRONTEND_URL: process.env.FRONTEND_URL || null,
    origenesPermitidos,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/cuentas', cuentasRoutes);
app.use('/api/reportes', reportesRoutes);

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada.' });
});

// Manejo de errores centralizado (SIEMPRE al final)
app.use(errorHandler);

module.exports = app;
