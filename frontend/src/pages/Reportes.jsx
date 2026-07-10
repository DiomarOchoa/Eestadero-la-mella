import { useEffect, useState } from 'react';
import { api } from '../api/client';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const formatoFechaHora = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const ETIQUETAS_PAGO = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  MIXTO: 'Mixto',
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Lista de campos de desglose de pago para el resumen por usuario (cierre de caja). */
const DESGLOSE_PAGO = [
  ['total_efectivo', 'Efectivo'],
  ['total_transferencia', 'Transferencia'],
  ['total_tarjeta', 'Tarjeta'],
  ['total_mixto', 'Mixto'],
];

export default function Reportes() {
  const [ventas, setVentas] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [cuentasDetalle, setCuentasDetalle] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [fechaCaja, setFechaCaja] = useState(hoyISO());
  const [cierreCaja, setCierreCaja] = useState(null);
  const [cargandoCaja, setCargandoCaja] = useState(true);
  const [errorCaja, setErrorCaja] = useState('');

  // IDs de cuentas actualmente expandidas en "Cuentas cerradas recientes"
  const [cuentasExpandidas, setCuentasExpandidas] = useState(() => new Set());

  useEffect(() => {
    Promise.all([
      api.get('/reportes/ventas-por-dia', { dias: 30 }),
      api.get('/reportes/productos-mas-vendidos', { limite: 10 }),
      api.get('/reportes/cuentas-detalle', { dias: 30 }),
    ])
      .then(([v, p, c]) => {
        setVentas(v.ventasPorDia);
        setTopProductos(p.productosMasVendidos);
        setCuentasDetalle(c.cuentasDetalle);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    setCargandoCaja(true);
    setErrorCaja('');
    api
      .get('/reportes/cierre-caja', { fecha: fechaCaja })
      .then((data) => setCierreCaja(data))
      .catch((err) => setErrorCaja(err.message))
      .finally(() => setCargandoCaja(false));
  }, [fechaCaja]);

  const maxVenta = Math.max(1, ...ventas.map((v) => Number(v.total_vendido)));

  function toggleCuenta(id) {
    setCuentasExpandidas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) {
        siguiente.delete(id);
      } else {
        siguiente.add(id);
      }
      return siguiente;
    });
  }

  function onKeyToggle(e, id) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCuenta(id);
    }
  }

  return (
    <div>
      <style>{`
        .reporte-row {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          transition: background-color 0.12s ease;
        }
        .reporte-row:last-child { border-bottom: none; }
        .reporte-row.clickable { cursor: pointer; }
        .reporte-row.clickable:hover,
        .reporte-row.clickable:focus-visible { background: var(--color-surface-raised); }
        .reporte-list {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--color-surface);
        }
        .reporte-chevron {
          display: inline-flex;
          flex-shrink: 0;
          transition: transform 0.15s ease;
          color: var(--color-text-muted);
          width: 14px;
        }
        .reporte-chevron.abierta { transform: rotate(90deg); }
        .reporte-detalle-productos {
          margin-top: var(--space-2);
          padding-top: var(--space-2);
          border-top: 1px dashed var(--color-border);
          padding-left: calc(14px + var(--space-2));
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
      `}</style>

      <div className="page-header">
        <div>
          <span className="eyebrow">Últimos 30 días</span>
          <h1>Reportes</h1>
          <p className="subtitle">Basado en cuentas cerradas</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {cargando ? (
        <div className="spinner" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2">
            <div className="card">
              <div className="card-title">Ventas por día</div>
              {ventas.length === 0 ? (
                <p className="text-muted text-sm">Aún no hay cuentas cerradas en este rango.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {ventas.map((v) => (
                    <div key={v.fecha}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="mono">{new Date(v.fecha).toLocaleDateString('es-CO')}</span>
                        <span className="mono">{formatoCOP.format(v.total_vendido)}</span>
                      </div>
                      <div style={{ background: 'var(--color-surface-raised)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${(Number(v.total_vendido) / maxVenta) * 100}%`,
                            background: 'var(--color-accent)',
                            height: 8,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Productos más vendidos</div>
              {topProductos.length === 0 ? (
                <p className="text-muted text-sm">Aún no hay ventas registradas.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Unidades</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProductos.map((p) => (
                        <tr key={p.id}>
                          <td>{p.nombre}</td>
                          <td className="mono">{p.unidades_vendidas}</td>
                          <td className="mono">{formatoCOP.format(p.total_generado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ---------- Cierre de caja: ancho completo, lista compacta por persona ---------- */}
          <div className="card">
            <div
              className="flex justify-between items-center gap-2"
              style={{ flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}
            >
              <div className="card-title" style={{ marginBottom: 0 }}>
                Cierre de caja — cuánto vendió cada quien
              </div>
              <input
                type="date"
                className="input"
                style={{ width: 'auto' }}
                value={fechaCaja}
                max={hoyISO()}
                onChange={(e) => setFechaCaja(e.target.value)}
              />
            </div>

            {errorCaja && <div className="form-error">{errorCaja}</div>}

            {cargandoCaja ? (
              <div className="spinner" />
            ) : !cierreCaja || cierreCaja.porUsuario.length === 0 ? (
              <p className="text-muted text-sm">Nadie cerró cuentas ese día.</p>
            ) : (
              <>
                <div className="reporte-list">
                  {cierreCaja.porUsuario.map((u) => {
                    const desglose = DESGLOSE_PAGO
                      .filter(([campo]) => Number(u[campo]) > 0)
                      .map(([campo, etiqueta]) => `${etiqueta} ${formatoCOP.format(u[campo])}`)
                      .join(' · ');
                    return (
                      <div key={u.usuario_id} className="reporte-row">
                        <div className="flex justify-between items-center gap-3">
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.usuario}</div>
                            <div className="text-muted text-sm">
                              {u.cuentas_cerradas} cuenta{u.cuentas_cerradas === 1 ? '' : 's'} cerrada
                              {u.cuentas_cerradas === 1 ? '' : 's'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div className="mono" style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>
                              {formatoCOP.format(u.total_vendido)}
                            </div>
                            {desglose && (
                              <div className="text-muted text-sm mono" style={{ fontSize: 'var(--fs-xs)' }}>
                                {desglose}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="flex justify-between"
                  style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}
                >
                  <span className="text-sm text-muted">
                    {cierreCaja.totales.cuentasCerradas} cuentas cerradas en total
                  </span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>
                    {formatoCOP.format(cierreCaja.totales.totalVendido)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ---------- Cuentas cerradas recientes: ancho completo, lista tipo recibo con detalle expandible ---------- */}
          <div className="card">
            <div className="card-title">Cuentas cerradas recientes</div>
            {cuentasDetalle.length === 0 ? (
              <p className="text-muted text-sm">Aún no hay cuentas cerradas en este rango.</p>
            ) : (
              <div className="reporte-list">
                {cuentasDetalle.map((c) => {
                  const abierta = cuentasExpandidas.has(c.id);
                  const productos = c.productos || [];
                  const metaPartes = [
                    formatoFechaHora.format(new Date(c.fecha_cierre)),
                    ETIQUETAS_PAGO[c.metodo_pago] || c.metodo_pago,
                  ];
                  if (c.para_llevar) metaPartes.push('Para llevar');
                  if (c.atendido_por) metaPartes.push(c.atendido_por);

                  return (
                    <div
                      key={c.id}
                      className="reporte-row clickable"
                      role="button"
                      tabIndex={0}
                      aria-expanded={abierta}
                      onClick={() => toggleCuenta(c.id)}
                      onKeyDown={(e) => onKeyToggle(e, c.id)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-2" style={{ minWidth: 0 }}>
                          <span className={`reporte-chevron${abierta ? ' abierta' : ''}`} aria-hidden="true">
                            ▶
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{c.cliente}</div>
                            <div className="text-muted text-sm mono" style={{ fontSize: 'var(--fs-xs)' }}>
                              {metaPartes.join(' · ')}
                            </div>
                          </div>
                        </div>
                        <div className="mono" style={{ fontWeight: 600, flexShrink: 0 }}>
                          {formatoCOP.format(c.total)}
                        </div>
                      </div>

                      {abierta && (
                        <div className="reporte-detalle-productos">
                          {productos.length === 0 ? (
                            <span className="text-muted text-sm">Sin productos registrados en esta cuenta.</span>
                          ) : (
                            productos.map((p, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-muted">
                                  {p.cantidad}× {p.producto}
                                </span>
                                <span className="mono">{formatoCOP.format(p.subtotal)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
