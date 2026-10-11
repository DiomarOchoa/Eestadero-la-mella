const { Router } = require('express');
const { autenticar, requerirSuscripcionActiva } = require('../middleware/auth');
const { listar, crear } = require('../controllers/clientesController');

const router = Router();

router.use(autenticar);

router.get('/', listar);
router.post('/', requerirSuscripcionActiva, crear);

module.exports = router;
