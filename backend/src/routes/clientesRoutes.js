const { Router } = require('express');
const { autenticar } = require('../middleware/auth');
const { listar, crear } = require('../controllers/clientesController');

const router = Router();

router.use(autenticar);

router.get('/', listar);
router.post('/', crear);

module.exports = router;
