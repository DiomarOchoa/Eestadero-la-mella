// backend/src/controllers/billingController.js
// Webhook genérico de cobro (Wompi / ePayco / manual).
// El proveedor llama a POST /api/billing/webhook con:
//   Header: x-webhook-secret: <BILLING_WEBHOOK_SECRET>
//   Body: { slug, plan: GRATIS|BASICO|PRO, diasExtension?: number, suscripcion_vence_en?: YYYY-MM-DD }
//
// Para Wompi: crea una Cloud Function / endpoint intermedio que verifique la firma
// (x-event-checksum) y reenvíe a este webhook con el secreto interno.
// Para ePayco: igual con su p_signature. Así el secreto nunca sale de tu servidor.

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const PLANES = {
  GRATIS: { nombre: 'Gratis', maxProductos: 20, precio: 0 },
  BASICO: { nombre: 'Básico', maxProductos: 200, precio: 49000 },
  PRO: { nombre: 'Pro', maxProductos: null, precio: 99000 },
};

/** GET /api/billing/planes (público) */
const listarPlanes = asyncHandler(async (req, res) => {
  res.json({ ok: true, planes: PLANES, trialDias: Number(process.env.TRIAL_DIAS) || 14 });
});

function verificarSecreto(req) {
  const esperado = process.env.BILLING_WEBHOOK_SECRET || '';
  if (!esperado) throw new ApiError(500, 'Webhook de cobro no configurado (BILLING_WEBHOOK_SECRET).');
  const recibido = String(req.headers['x-webhook-secret'] || '');
  if (!recibido || recibido !== esperado) throw new ApiError(401, 'Firma del webhook inválida.');
}

/** POST /api/billing/webhook */
const webhook = asyncHandler(async (req, res) => {
  verificarSecreto(req);
  const slug = String(req.body.slug || '').trim().toLowerCase();
  const plan = String(req.body.plan || '').toUpperCase();
  const diasExtension = req.body.diasExtension === undefined ? null : Number(req.body.diasExtension);
  const venceEn = req.body.suscripcion_vence_en || null;

  if (!slug) throw new ApiError(400, 'slug es obligatorio.');
  if (!PLANES[plan]) throw new ApiError(400, 'plan inválido. Usa GRATIS, BASICO o PRO.');
  if (diasExtension !== null && (!Number.isInteger(diasExtension) || diasExtension < 0 || diasExtension > 3650)) {
    throw new ApiError(400, 'diasExtension debe ser entero entre 0 y 3650.');
  }
  if (venceEn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(venceEn)) {
    throw new ApiError(400, 'suscripcion_vence_en debe ser YYYY-MM-DD.');
  }

  const { rows: neg } = await query('SELECT id, suscripcion_vence_en FROM negocios WHERE slug = $1', [slug]);
  if (!neg[0]) throw new ApiError(404, 'Negocio no encontrado.');

  let nuevoVencimiento = venceEn;
  if (!nuevoVencimiento && diasExtension !== null) {
    const base = neg[0].suscripcion_vence_en ? new Date(neg[0].suscripcion_vence_en) : new Date();
    if (Number.isNaN(base.getTime()) || base < new Date()) {
      const hoy = new Date();
      hoy.setDate(hoy.getDate() + diasExtension);
      nuevoVencimiento = hoy.toISOString().slice(0, 10);
    } else {
      base.setDate(base.getDate() + diasExtension);
      nuevoVencimiento = base.toISOString().slice(0, 10);
    }
  }

  const { rows } = await query(
    `UPDATE negocios SET plan = $1::text,
       suscripcion_vence_en = CASE WHEN $1 = 'GRATIS' THEN NULL ELSE COALESCE($2::date, suscripcion_vence_en) END
     WHERE slug = $3 RETURNING id, nombre, slug, plan, suscripcion_vence_en`,
    [plan, nuevoVencimiento, slug]
  );
  res.json({ ok: true, negocio: rows[0] });
});

/**
 * GET /api/billing/estado (autenticado)
 * Estado de suscripción del negocio: plan, vencimiento, días restantes,
 * si está en prueba y si está vencido. Lo usa la página /planes y el Dashboard.
 */
const estado = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT plan, suscripcion_vence_en FROM negocios WHERE id = $1`,
    [req.negocioId]
  );
  if (!rows[0]) throw new ApiError(404, 'Negocio no encontrado.');
  const { plan, suscripcion_vence_en } = rows[0];
  let diasRestantes = null;
  let vencido = false;
  if (suscripcion_vence_en) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    diasRestantes = Math.ceil((new Date(suscripcion_vence_en) - hoy) / 86400000);
    vencido = diasRestantes < 0;
  }
  res.json({
    ok: true,
    estado: { plan, venceEn: suscripcion_vence_en, diasRestantes, vencido, enPrueba: plan === 'PRO' && !vencido && diasRestantes !== null && diasRestantes <= (Number(process.env.TRIAL_DIAS) || 14) },
  });
});

module.exports = { listarPlanes, webhook, estado };
