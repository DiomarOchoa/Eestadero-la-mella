const { Router } = require('express');
const { autenticar } = require('../middleware/auth');
const { ventasPorDia, productosMasVendidos, resumen } = require('../controllers/reportesController');

const router = Router();

router.use(autenticar);

router.get('/resumen', resumen);
router.get('/ventas-por-dia', ventasPorDia);
router.get('/productos-mas-vendidos', productosMasVendidos);

module.exports = router;
