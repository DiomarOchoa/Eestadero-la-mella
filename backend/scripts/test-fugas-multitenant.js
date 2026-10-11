/**
 * Test manual de fugas multi-tenant (guía GUIA_MULTI_TENANT.md).
 * Uso:
 *   API_URL=http://localhost:4000/api node scripts/test-fugas-multitenant.js
 *
 * Requiere 2 negocios con usuarios admin:
 *   TOKEN_A=... TOKEN_B=... PRODUCTO_B_ID=... node scripts/test-fugas-multitenant.js
 */
const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const TOKEN_A = process.env.TOKEN_A || '';
const TOKEN_B = process.env.TOKEN_B || '';
const PRODUCTO_B_ID = process.env.PRODUCTO_B_ID || '';

async function get(path, token) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  if (!TOKEN_A || !TOKEN_B) {
    console.log('Define TOKEN_A y TOKEN_B (JWT de admin de negocio A y B).');
    console.log('Ejemplo: TOKEN_A=xxx TOKEN_B=yyy node scripts/test-fugas-multitenant.js');
    process.exit(1);
  }
  let fallos = 0;
  const check = (nombre, ok, detalle = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} - ${nombre}${detalle ? ` (${detalle})` : ''}`);
    if (!ok) fallos += 1;
  };

  // 1. Productos de A no incluyen los de B
  const prodA = await get('/productos', TOKEN_A);
  const prodB = await get('/productos', TOKEN_B);
  const idsA = new Set((prodA.data?.productos || []).map((p) => p.id));
  const idsB = new Set((prodB.data?.productos || []).map((p) => p.id));
  const interseccion = [...idsA].filter((id) => idsB.has(id));
  check('Aislamiento en GET /productos', interseccion.length === 0, `intersección=${interseccion.length}`);

  // 2. PATCH de A sobre producto de B -> 404
  if (PRODUCTO_B_ID) {
    const res = await fetch(`${API_URL}/productos/${PRODUCTO_B_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN_A}` },
      body: JSON.stringify({ nombre: 'intento-fuga' }),
    });
    check('PATCH cruzado responde 404', res.status === 404, `status=${res.status}`);
  } else {
    console.log('SKIP - PATCH cruzado (define PRODUCTO_B_ID)');
  }

  // 3. /auth/me de cada token trae negocio distinto
  const meA = await get('/auth/me', TOKEN_A);
  const meB = await get('/auth/me', TOKEN_B);
  check(
    'Tokens pertenecen a negocios distintos',
    meA.data?.negocio?.id && meB.data?.negocio?.id && meA.data.negocio.id !== meB.data.negocio.id,
    `A=${meA.data?.negocio?.slug} B=${meB.data?.negocio?.slug}`
  );

  // 4. Caja actual es independiente (no falla por turno del otro negocio)
  const cajaA = await get('/caja/actual', TOKEN_A);
  const cajaB = await get('/caja/actual', TOKEN_B);
  check('GET /caja/actual responde por negocio', cajaA.status === 200 && cajaB.status === 200);

  // 5. Reportes no mezclan (smoke: ambos 200)
  const repA = await get('/reportes/resumen', TOKEN_A);
  const repB = await get('/reportes/resumen', TOKEN_B);
  check('GET /reportes/resumen por negocio', repA.status === 200 && repB.status === 200);

  if (fallos > 0) {
    console.log(`\n${fallos} check(s) fallaron.`);
    process.exit(1);
  }
  console.log('\nTodo OK: sin fugas detectadas en estos checks.');
}

main().catch((e) => {
  console.error('Error ejecutando test:', e.message);
  process.exit(1);
});
