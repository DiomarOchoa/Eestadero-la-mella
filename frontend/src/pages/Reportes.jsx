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

  // IDs de cuentas actualmente expandidas en la tabla de "Cuentas cerradas recientes"
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

  return (
    <div>
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
        <div className="grid grid-cols-2" style={{ alignItems: 'start' }}>
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

          <div className="card mt-4">
            <div
              className="flex justify-between items-center gap-2"
              style={{ flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}
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
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Atendió</th>
                        <th>Cuentas</th>
                        <th>Efectivo</th>
                        <th>Transferencia</th>
                        <th>Tarjeta</th>
                        <th>Mixto</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cierreCaja.porUsuario.map((u) => (
                        <tr key={u.usuario_id}>
                          <td>{u.usuario}</td>
                          <td className="mono">{u.cuentas_cerradas}</td>
                          <td className="mono">{formatoCOP.format(u.total_efectivo || 0)}</td>
                          <td className="mono">{formatoCOP.format(u.total_transferencia || 0)}</td>
                          <td className="mono">{formatoCOP.format(u.total_tarjeta || 0)}</td>
                          <td className="mono">{formatoCOP.format(u.total_mixto || 0)}</td>
                          <td className="mono">{formatoCOP.format(u.total_vendido)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div
                  className="flex justify-between"
                  style={{ borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)' }}
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

          <div className="card mt-4">
            <div className="card-title">Cuentas cerradas recientes</div>
            {cuentasDetalle.length === 0 ? (
              <p className="text-muted text-sm">Aún no hay cuentas cerradas en este rango.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>Cliente</th>
                      <th>Cierre</th>
                      <th>Método de pago</th>
                      <th>Para llevar</th>
                      <th>Atendió</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentasDetalle.map((c) => {
                      const abierta = cuentasExpandidas.has(c.id);
                      const productos = c.productos || [];
                      return (
                        <>
                          <tr
                            key={c.id}
                            onClick={() => toggleCuenta(c.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <span
                                aria-label={abierta ? 'Contraer detalle' : 'Expandir detalle'}
                                style={{
                                  display: 'inline-block',
                                  transition: 'transform 0.15s ease',
                                  transform: abierta ? 'rotate(90deg)' : 'rotate(0deg)',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                ▶
                              </span>
                            </td>
                            <td>{c.cliente}</td>
                            <td className="mono">{formatoFechaHora.format(new Date(c.fecha_cierre))}</td>
                            <td>{ETIQUETAS_PAGO[c.metodo_pago] || c.metodo_pago || '—'}</td>
                            <td>{c.para_llevar ? 'Sí' : 'No'}</td>
                            <td>{c.atendido_por || '—'}</td>
                            <td className="mono">{formatoCOP.format(c.total)}</td>
                          </tr>

                          {abierta && (
                            <tr key={`${c.id}-detalle`}>
                              <td></td>
                              <td colSpan={6} style={{ background: 'var(--color-bg-alt)', padding: 0 }}>
                                {productos.length === 0 ? (
                                  <p className="text-muted text-sm" style={{ padding: 'var(--space-2) var(--space-3)' }}>
                                    Sin productos registrados en esta cuenta.
                                  </p>
                                ) : (
                                  <table className="data-table" style={{ background: 'transparent' }}>
                                    <thead>
                                      <tr>
                                        <th>Producto</th>
                                        <th>Cantidad</th>
                                        <th>Precio unitario</th>
                                        <th>Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {productos.map((p, idx) => (
                                        <tr key={idx}>
                                          <td>{p.producto}</td>
                                          <td className="mono">{p.cantidad}</td>
                                          <td className="mono">{formatoCOP.format(p.precio_unitario)}</td>
                                          <td className="mono">{formatoCOP.format(p.subtotal)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
