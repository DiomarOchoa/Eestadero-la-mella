const cajaRoutes = require('./routes/cajaroutes');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const errorHandler = require('./middleware/errorHandler');
const { limiteAuth, limiteGeneral } = require('./middleware/rateLimit');
const authRoutes = require('./routes/authRoutes');
const negociosRoutes = require('./routes/negociosRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const productosRoutes = require('./routes/productosRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const cuentasRoutes = require('./routes/cuentasRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const adminRoutes = require('./routes/adminRoutes');
const billingRoutes = require('./routes/billingRoutes');

const app = express();

// Necesario en Render/Vercel para que req.ip sea la real tras el proxy.
app.set('trust proxy', 1);

const origenesPermitidos = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origenesPermitidos.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    ok: true,
    servicio: 'Estadero La Mella API',
    estado: 'online',
    health: '/api/health',
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'Estadero La Mella API', hora: new Date().toISOString() });
});

app.use('/api/auth', limiteAuth, authRoutes);
app.use('/api/negocios', limiteAuth, negociosRoutes);
app.use('/api/usuarios', limiteGeneral, usuariosRoutes);
app.use('/api/productos', limiteGeneral, productosRoutes);
app.use('/api/clientes', limiteGeneral, clientesRoutes);
app.use('/api/cuentas', limiteGeneral, cuentasRoutes);
app.use('/api/reportes', limiteGeneral, reportesRoutes);
app.use('/api/caja', limiteGeneral, cajaRoutes);
app.use('/api/admin', limiteGeneral, adminRoutes);
app.use('/api/billing', billingRoutes);

app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada.' });
});

app.use(errorHandler);

module.exports = app;
