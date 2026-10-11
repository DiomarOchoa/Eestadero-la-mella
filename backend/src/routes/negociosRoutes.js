const { Router } = require('express');
const { body } = require('express-validator');
const validar = require('../middleware/validate');
const { autenticar, autorizar } = require('../middleware/auth');
const { crear, publicoPorSlug, manifestPorSlug, actualizarMio } = require('../controllers/negociosController');

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

// Negocio propio (requiere sesión). VA ANTES de /:slug para no chocar.
router.patch('/mio', autenticar, autorizar('ADMIN'), actualizarMio);

// Branding público por negocio (login, PWA). Deben ir ANTES de rutas genéricas.
router.get('/:slug/manifest.json', manifestPorSlug);
router.get('/:slug/publico', publicoPorSlug);

module.exports = router;
