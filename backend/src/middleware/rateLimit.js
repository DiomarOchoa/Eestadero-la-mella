// backend/src/middleware/rateLimit.js
// Rate-limit en memoria sin dependencias (suficiente para 1-3 instancias).
// Para >3 instancias usar Redis. Se aplica por IP + ruta base.

const registros = new Map();

function limpiarExpirados(ahora) {
  for (const [clave, v] of registros) {
    if (v.resetEn <= ahora) registros.delete(clave);
  }
}

/**
 * @param {object} opts { ventanaMs, maximo, mensaje }
 */
function limitar({ ventanaMs = 60000, maximo = 100, mensaje = 'Demasiadas solicitudes. Intenta de nuevo en un momento.' } = {}) {
  return (req, res, next) => {
    const ahora = Date.now();
    if (registros.size > 5000 && Math.random() < 0.1) limpiarExpirados(ahora);

    const ip = req.ip || req.headers['x-forwarded-for'] || 'desconocida';
    const clave = `${ip}:${req.baseUrl || ''}`;
    let entrada = registros.get(clave);

    if (!entrada || entrada.resetEn <= ahora) {
      entrada = { conteo: 0, resetEn: ahora + ventanaMs };
      registros.set(clave, entrada);
    }
    entrada.conteo += 1;

    res.setHeader('X-RateLimit-Limit', String(maximo));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maximo - entrada.conteo)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entrada.resetEn / 1000)));

    if (entrada.conteo > maximo) {
      return res.status(429).json({ ok: false, mensaje });
    }
    next();
  };
}

// Estrictos para login/registro (anti fuerza bruta), holgados para el resto.
const limiteAuth = limitar({ ventanaMs: 15 * 60 * 1000, maximo: 30 });
const limiteGeneral = limitar({ ventanaMs: 60 * 1000, maximo: 300 });

module.exports = { limitar, limiteAuth, limiteGeneral };
