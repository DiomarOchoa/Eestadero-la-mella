import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function Dashboard() {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await api.get('/reportes/resumen');
      setResumen(data.resumen);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, 20000); // refresco tipo "tiempo real"
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Estadero La Mella</span>
          <h1>Dashboard</h1>
          <p className="subtitle">Estado del negocio en este momento</p>
        </div>
        <Link to="/cuentas/nueva" className="btn btn-primary">+ Abrir cuenta</Link>
      </div>

      {error && <div className="form-error">{error}</div>}

      {cargando && !resumen ? (
        <div className="spinner" />
      ) : (
        <div className="grid grid-cols-4">
          <div className="stat-card">
            <div className="stat-label">Cuentas abiertas</div>
            <div className="stat-value">{resumen.cuentasAbiertas}</div>
            <div className="stat-hint">En este momento en el estadero</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Vendido hoy</div>
            <div className="stat-value">{formatoCOP.format(resumen.totalVendidoHoy)}</div>
            <div className="stat-hint">{resumen.cuentasCerradasHoy} cuentas cerradas hoy</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Alertas de stock</div>
            <div className="stat-value">{resumen.productosBajoStock}</div>
            <div className="stat-hint">Productos bajo el mínimo</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Acceso rápido</div>
            <div className="flex flex-col gap-2 mt-2">
              <Link to="/cuentas" className="btn btn-outline btn-sm">Ver cuentas abiertas</Link>
              <Link to="/inventario" className="btn btn-outline btn-sm">Ver inventario</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
