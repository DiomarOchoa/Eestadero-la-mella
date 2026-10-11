const { Router } = require('express');
const { body } = require('express-validator');
const { autenticar, autorizar, requerirSuscripcionActiva } = require('../middleware/auth');
const validar = require('../middleware/validate');
const { listar, crear, actualizar, eliminar, bajoStock } = require('../controllers/productosController');

const router = Router();

router.use(autenticar);

router.get('/', listar);
router.get('/inventario/bajo-stock', bajoStock);

router.post(
  '/',
  autorizar('ADMIN'),
  requerirSuscripcionActiva,
  [
    body('nombre').notEmpty(),
    body('tipo').notEmpty(),
    body('precio').isFloat({ min: 0 })
  ],
  validar,
  crear
);

router.patch('/:id', autorizar('ADMIN'), requerirSuscripcionActiva, actualizar);
router.delete('/:id', autorizar('ADMIN'), requerirSuscripcionActiva, eliminar);

module.exports = router;
