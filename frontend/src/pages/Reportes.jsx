import { useEffect, useState } from 'react';
import { api } from '../api/client';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function Reportes() {
  const [ventas, setVentas] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/reportes/ventas-por-dia', { dias: 14 }),
      api.get('/reportes/productos-mas-vendidos', { limite: 10 }),
    ])
      .then(([v, p]) => {
        setVentas(v.ventasPorDia);
        setTopProductos(p.productosMasVendidos);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  const maxVenta = Math.max(1, ...ventas.map((v) => Number(v.total_vendido)));

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Últimos 14 días</span>
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
        </div>
      )}
    </div>
  );
}
