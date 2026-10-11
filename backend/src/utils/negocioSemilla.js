// backend/src/utils/negocioSemilla.js
// Slug del negocio semilla del dueño del SaaS.
// Antes era 'lamella'; ahora es 'diom444r'. El arranque renombra
// automáticamente el viejo al nuevo (ver server.js prepararMultiTenant).

const SLUG_SEMILLA = String(process.env.NEGOCIO_SEMILLA_SLUG || 'diom444r')
  .trim()
  .toLowerCase();
const SLUG_ANTERIOR = 'lamella';

module.exports = { SLUG_SEMILLA, SLUG_ANTERIOR };
