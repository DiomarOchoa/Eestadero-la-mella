const { Router } = require('express');
const { body } = require('express-validator');
const { autenticar, autorizar } = require('../middleware/auth');
const validar = require('../middleware/validate');
const { listar, crear, actualizar } = require('../controllers/usuariosController');

const router = Router();

router.use(autenticar, autorizar('ADMIN'));

router.get('/', listar);

router.post(
  '/',
  [
    body('nombreCompleto').notEmpty(),
    body('username').notEmpty().isLength({ min: 3 }),
    body('password').notEmpty().isLength({ min: 6 }),
  ],
  validar,
  crear
);

router.patch('/:id', actualizar);

module.exports = router;
