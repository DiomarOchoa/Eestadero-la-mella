const { Router } = require('express');
const { body } = require('express-validator');
const { autenticar, autorizar } = require('../middleware/auth');
const validar = require('../middleware/validate');
const { listar, crear, actualizar, eliminar, bajoStock } = require('../controllers/productosController');

const router = Router();

router.use(autenticar);

// =========================
// PRODUCTOS
// =========================

router.get('/', listar);
router.get('/inventario/bajo-stock', bajoStock);

router.post(
  '/',
  autorizar('ADMIN'),
  [
    body('nombre').notEmpty(),
    body('tipo').notEmpty(),
    body('precio').isFloat({ min: 0 })
  ],
  validar,
  crear
);

router.patch('/:id', autorizar('ADMIN'), actualizar);
router.delete('/:id', autorizar('ADMIN'), eliminar);

// =========================
// CAJA
// =========================

let cajaAbierta = false;

router.get('/caja', (req, res) => {
  res.json({ abierta: cajaAbierta });
});

router.post('/caja/abrir', (req, res) => {
  cajaAbierta = true;
  res.json({ abierta: true });
});

router.post('/caja/cerrar', (req, res) => {
  cajaAbierta = false;
  res.json({ abierta: false });
});

// =========================

module.exports = router;
