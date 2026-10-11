const { Router } = require('express');
const { autenticar } = require('../middleware/auth');
const { listarPlanes, webhook, estado } = require('../controllers/billingController');

const router = Router();

router.get('/planes', listarPlanes);
router.get('/estado', autenticar, estado);
router.post('/webhook', webhook);

module.exports = router;
