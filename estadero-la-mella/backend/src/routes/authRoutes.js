const { Router } = require('express');
const { body } = require('express-validator');
const validar = require('../middleware/validate');
const { autenticar } = require('../middleware/auth');
const { login, me } = require('../controllers/authController');

const router = Router();

router.post(
  '/login',
  [body('username').notEmpty(), body('password').notEmpty()],
  validar,
  login
);

router.get('/me', autenticar, me);

module.exports = router;
