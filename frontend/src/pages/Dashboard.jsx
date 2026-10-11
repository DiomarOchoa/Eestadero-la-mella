import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Receipt, Package, Wallet, TriangleAlert } from 'lucide-react';
import { api } from '../api/client';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function Dashboard() {
  const [resumen, setResumen] = useState(null);
  const [suscripcion, setSuscripcion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true);
    try {
      const [data, billing] = await Promise.all([
        api.get('/reportes/resumen'),
        api.get('/billing/estado').catch(() => null),
      ]);
      setResumen(data.resumen);
      if (billing?.estado) setSuscripcion(billing.estado);
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
        <Link to="/cuentas/nueva" className="btn btn-primary"><PlusCircle size={16} /> Abrir cuenta</Link>
      </div>

      {error && <div className="form-error">{error}</div>}

      {suscripcion && (suscripcion.enPrueba || (suscripcion.diasRestantes !== null && suscripcion.diasRestantes <= 3)) && !suscripcion.vencido && (
        <div className="card mb-4 flex justify-between items-center gap-3">
          <div>
            <strong>
              {suscripcion.enPrueba
                ? `Prueba PRO: te quedan ${suscripcion.diasRestantes} día(s)`
                : `Tu plan vence en ${suscripcion.diasRestantes} día(s)`}
            </strong>
            <div className="text-sm text-muted">Elige un plan para no interrumpir tus ventas.</div>
          </div>
          <Link to="/planes" className="btn btn-primary btn-sm">Ver planes</Link>
        </div>
      )}
      {suscripcion?.vencido && (
        <div className="form-error">
          Tu suscripción venció. No puedes registrar ventas hasta renovar. <Link to="/planes">Ver planes</Link>
        </div>
      )}

      {cargando && !resumen ? (
        <div className="spinner" />
      ) : (
        <div className="grid grid-cols-4">
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-icon"><Receipt size={20} /></span>
              <span className="live-dot">En vivo</span>
            </div>
            <div className="stat-label">Cuentas abiertas</div>
            <div className="stat-value">{resumen.cuentasAbiertas}</div>
            <div className="stat-hint">En este momento en el estadero</div>
          </div>
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-icon"><Wallet size={20} /></span>
            </div>
            <div className="stat-label">Vendido hoy</div>
            <div className="stat-value">{formatoCOP.format(resumen.totalVendidoHoy)}</div>
            <div className="stat-hint">{resumen.cuentasCerradasHoy} cuentas cerradas hoy</div>
          </div>
          <div className="stat-card">
            <div className="stat-top">
              <span className="stat-icon"><TriangleAlert size={20} /></span>
            </div>
            <div className="stat-label">Alertas de stock</div>
            <div className="stat-value">{resumen.productosBajoStock}</div>
            <div className="stat-hint">Productos bajo el mínimo</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Acceso rápido</div>
            <div className="flex flex-col gap-2 mt-2">
              <Link to="/cuentas" className="btn btn-outline btn-sm"><Receipt size={14} /> Ver cuentas abiertas</Link>
              <Link to="/inventario" className="btn btn-outline btn-sm"><Package size={14} /> Ver inventario</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
