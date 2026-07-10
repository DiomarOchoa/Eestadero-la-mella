const express = require('express');
const router = express.Router();

let cajaAbierta = true;
let historialCierres = [];

// 📦 Obtener estado de caja
router.get('/estado', (req, res) => {
  res.json({ ok: true, cajaAbierta });
});

// 🔒 Cerrar caja
router.post('/cerrar', (req, res) => {
  if (!cajaAbierta) {
    return res.status(400).json({ ok: false, mensaje: 'La caja ya está cerrada' });
  }

  const resumen = {
    fecha: new Date(),
    totalVentas: Math.floor(Math.random() * 500000), // luego conectamos real
    totalProductos: Math.floor(Math.random() * 100),
  };

  historialCierres.push(resumen);
  cajaAbierta = false;

  res.json({
    ok: true,
    mensaje: 'Caja cerrada correctamente',
    resumen,
  });
});

// 🔓 Abrir caja
router.post('/abrir', (req, res) => {
  if (cajaAbierta) {
    return res.status(400).json({ ok: false, mensaje: 'La caja ya está abierta' });
  }

  cajaAbierta = true;

  res.json({
    ok: true,
    mensaje: 'Caja abierta correctamente',
  });
});

// 📊 Historial
router.get('/historial', (req, res) => {
  res.json({
    ok: true,
    historial: historialCierres,
  });
});

module.exports = router;
