const { Router } = require('express');
const { autenticar, soloSuperAdmin } = require('../middleware/auth');
const { listarNegocios, actualizarNegocio, resumenGlobal, bootstrap, eliminarNegocio, usuariosPorNegocio } = require('../controllers/adminController');

const router = Router();

// Un solo uso, sin auth (verificado por secreto + "solo si no hay superadmin").
router.post('/bootstrap', bootstrap);

router.use(autenticar, soloSuperAdmin);

router.get('/negocios', listarNegocios);
router.get('/negocios/:id/usuarios', usuariosPorNegocio);
router.patch('/negocios/:id', actualizarNegocio);
router.delete('/negocios/:id', eliminarNegocio);
router.get('/resumen', resumenGlobal);

module.exports = router;
