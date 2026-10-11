/** "Bar El Rincón" -> "bar-el-rincon" (puro, testeable sin DB). */
function generarSlugBase(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

module.exports = { generarSlugBase };
