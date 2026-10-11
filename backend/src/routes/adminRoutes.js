const { Router } = require('express');
const { autenticar, soloSuperAdmin } = require('../middleware/auth');
const { listarNegocios, actualizarNegocio, resumenGlobal } = require('../controllers/adminController');

const router = Router();
router.use(autenticar, soloSuperAdmin);

router.get('/negocios', listarNegocios);
router.patch('/negocios/:id', actualizarNegocio);
router.get('/resumen', resumenGlobal);

module.exports = router;
