const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { limitar } = require('../src/middleware/rateLimit');

function contextoSimulado(ip = '1.2.3.4') {
  const req = { ip, baseUrl: '/api/test', headers: {} };
  const headers = {};
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    status: function (code) { this.statusCode = code; return this; },
    json: function (body) { this.body = body; return this; },
  };
  return { req, res, headers };
}

describe('rateLimit', () => {
  it('permite hasta el maximo y luego responde 429', () => {
    const mw = limitar({ ventanaMs: 60000, maximo: 3 });
    const { req, res } = contextoSimulado('9.9.9.9');
    let pasaron = 0;
    for (let i = 0; i < 3; i++) {
      mw(req, res, () => { pasaron += 1; });
    }
    assert.equal(pasaron, 3);
    let bloqueado = false;
    const siguiente = () => { bloqueado = false; };
    mw(req, res, siguiente);
    assert.equal(res.statusCode, 429);
    assert.equal(res.body.ok, false);
  });

  it('cuenta por separado cada IP', () => {
    const mw = limitar({ ventanaMs: 60000, maximo: 1 });
    const a = contextoSimulado('10.0.0.1');
    const b = contextoSimulado('10.0.0.2');
    let n = 0;
    mw(a.req, a.res, () => { n += 1; });
    mw(b.req, b.res, () => { n += 1; });
    assert.equal(n, 2);
  });

  it('expone headers X-RateLimit-*', () => {
    const mw = limitar({ ventanaMs: 60000, maximo: 5 });
    const { req, res, headers } = contextoSimulado('10.0.0.3');
    mw(req, res, () => {});
    assert.equal(headers['X-RateLimit-Limit'], '5');
    assert.equal(headers['X-RateLimit-Remaining'], '4');
  });
});
