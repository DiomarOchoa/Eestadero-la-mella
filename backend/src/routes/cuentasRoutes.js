const { Router } = require('express');
const { autenticar } = require('../middleware/auth');
const {
  listar,
  obtener,
  abrir,
  actualizar,
  agregarProducto,
  eliminarProducto,
  actualizarCantidad,
  cerrar,
} = require('../controllers/cuentasController');

const router = Router();

router.use(autenticar);

router.get('/', listar);
router.get('/:id', obtener);
router.post('/', abrir);
router.patch('/:id', actualizar);
router.post('/:id/productos', agregarProducto);
router.patch('/:id/productos/:itemId', actualizarCantidad);
router.delete('/:id/productos/:itemId', eliminarProducto);
router.post('/:id/cerrar', cerrar);

module.exports = router;
