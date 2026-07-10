const { Router } = require('express');
const { autenticar, autorizar } = require('../middleware/auth');

const router = Router();

router.use(autenticar);

// ⚠️ IMPORTANTE: MISMO ESTADO GLOBAL
let cajaAbierta = true; // sincroniza con productos si quieres luego

// =========================
// CREAR VENTA
// =========================

router.post('/', async (req, res) => {
  if (!cajaAbierta) {
    return res.status(400).json({ error: 'Caja cerrada' });
  }

  const { total } = req.body;

  // Simulación (reemplaza con DB real)
  res.json({ mensaje: 'Venta registrada', total });
});

// =========================
// ELIMINAR VENTA (ADMIN)
// =========================

router.delete('/:id', autorizar('ADMIN'), async (req, res) => {
  const { id } = req.params;

  // Aquí deberías borrar en DB real
  res.json({ mensaje: `Venta ${id} eliminada` });
});

// =========================
// RESET TOTAL (ADMIN)
// =========================

router.post('/reset', autorizar('ADMIN'), async (req, res) => {
  // ⚠️ En DB real aquí borrarías todo
  res.json({ mensaje: 'Sistema reiniciado' });
});

// =========================

module.exports = router;
