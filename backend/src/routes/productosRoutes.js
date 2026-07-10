const { Router } = require('express');
const { body } = require('express-validator');
const { autenticar, autorizar } = require('../middleware/auth');
const validar = require('../middleware/validate');
const { listar, crear, actualizar, bajoStock } = require('../controllers/productosController');

const router = Router();

router.use(autenticar);

router.get('/', listar);
router.get('/inventario/bajo-stock', bajoStock);

// Crear/editar productos requiere rol ADMIN (control de inventario/precio)
router.post(
  '/',
  autorizar('ADMIN'),
  [body('nombre').notEmpty(), body('tipo').notEmpty(), body('precio').isFloat({ min: 0 })],
  validar,
  crear
);

router.patch('/:id', autorizar('ADMIN'), actualizar);

module.exports = router;
