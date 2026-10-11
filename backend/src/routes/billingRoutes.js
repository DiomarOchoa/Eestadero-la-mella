const { Router } = require('express');
const { listarPlanes, webhook } = require('../controllers/billingController');

const router = Router();

router.get('/planes', listarPlanes);
router.post('/webhook', webhook);

module.exports = router;
