const { Router } = require('express');
const { autenticar, soloSuperAdmin } = require('../middleware/auth');
const { listarNegocios, actualizarNegocio, resumenGlobal, bootstrap } = require('../controllers/adminController');

const router = Router();

// Un solo uso, sin auth (verificado por secreto + "solo si no hay superadmin").
router.post('/bootstrap', bootstrap);

router.use(autenticar, soloSuperAdmin);

router.get('/negocios', listarNegocios);
router.patch('/negocios/:id', actualizarNegocio);
router.get('/resumen', resumenGlobal);

module.exports = router;
