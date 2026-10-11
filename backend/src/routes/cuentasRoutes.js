const { Router } = require('express');
const { autenticar, requerirSuscripcionActiva } = require('../middleware/auth');
const {
  listar,
  obtener,
  abrir,
  actualizar,
  agregarProducto,
  eliminarProducto,
  actualizarCantidad,
  cerrar,
  cancelar,
} = require('../controllers/cuentasController');

const router = Router();

router.use(autenticar);

router.get('/', listar);
router.get('/:id', obtener);
router.post('/', requerirSuscripcionActiva, abrir);
router.patch('/:id', requerirSuscripcionActiva, actualizar);
router.post('/:id/productos', requerirSuscripcionActiva, agregarProducto);
router.patch('/:id/productos/:itemId', requerirSuscripcionActiva, actualizarCantidad);
router.delete('/:id/productos/:itemId', requerirSuscripcionActiva, eliminarProducto);
router.post('/:id/cerrar', requerirSuscripcionActiva, cerrar);
router.post('/:id/cancelar', requerirSuscripcionActiva, cancelar);

module.exports = router;
