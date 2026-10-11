const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { obtenerPaginacion, respuestaPaginada } = require('../src/utils/paginacion');
const { generarSlugBase } = require('../src/utils/slug');

describe('paginacion', () => {
  it('valores por defecto: pagina 1, limite 20, offset 0', () => {
    assert.deepEqual(obtenerPaginacion({}), { page: 1, limit: 20, offset: 0 });
  });

  it('calcula offset y topa el limite al maximo', () => {
    assert.deepEqual(obtenerPaginacion({ page: '3', limit: '500' }), { page: 3, limit: 100, offset: 200 });
  });

  it('corrige valores invalidos', () => {
    assert.deepEqual(obtenerPaginacion({ page: '-2', limit: 'abc' }), { page: 1, limit: 20, offset: 0 });
    assert.deepEqual(obtenerPaginacion({ page: '1.5', limit: '0' }), { page: 1, limit: 20, offset: 0 });
  });

  it('respuestaPaginada incluye meta y datos bajo la clave', () => {
    const res = respuestaPaginada({ page: 2, limit: 10, total: 25, datos: [{ id: 1 }], clave: 'productos' });
    assert.equal(res.ok, true);
    assert.deepEqual(res.productos, [{ id: 1 }]);
    assert.deepEqual(res.paginacion, { pagina: 2, limite: 10, total: 25, totalPaginas: 3 });
  });
});

describe('slug', () => {
  it('normaliza tildes, mayusculas y espacios', () => {
    assert.equal(generarSlugBase('Bar El Rincón'), 'bar-el-rincon');
  });

  it('limpia bordes y limita a 50 caracteres', () => {
    assert.equal(generarSlugBase('---Hola___Mundo---'), 'hola-mundo');
    assert.ok(generarSlugBase('a'.repeat(100)).length <= 50);
  });

  it('vacio devuelve vacio (el controlador aplica fallback)', () => {
    assert.equal(generarSlugBase(''), '');
    assert.equal(generarSlugBase(null), '');
  });
});
