const { Router } = require('express');
const { body } = require('express-validator');
const validar = require('../middleware/validate');
const { crear } = require('../controllers/negociosController');

const router = Router();

// SIN middleware "autenticar": es la puerta de entrada para negocios nuevos.
router.post(
  '/',
  [
    body('nombreNegocio').notEmpty(),
    body('nombreCompleto').notEmpty(),
    body('username').notEmpty().isLength({ min: 3, max: 50 }),
    body('password').notEmpty().isLength({ min: 6 }),
  ],
  validar,
  crear
);

module.exports = router;
