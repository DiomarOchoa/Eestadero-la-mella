import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { api } from '../api/client';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function tiempoTranscurrido(fechaIso) {
  const minutos = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 60000);
  if (minutos < 1) return 'recién abierta';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `hace ${horas} h ${minutos % 60} min`;
}

export default function CuentasAbiertas() {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async () => {
    try {
      const data = await api.get('/cuentas', { estado: 'ABIERTA' });
      setCuentas(data.cuentas);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, 10000); // "tiempo real" vía polling corto
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">{cuentas.length} abiertas</span>
          <h1>Cuentas abiertas</h1>
          <p className="subtitle">Se actualiza automáticamente cada 10 segundos</p>
        </div>
        <Link to="/cuentas/nueva" className="btn btn-primary"><PlusCircle size={16} /> Abrir cuenta</Link>
      </div>

      {error && <div className="form-error">{error}</div>}

      {cargando ? (
        <div className="spinner" />
      ) : cuentas.length === 0 ? (
        <div className="empty-state card">
          <span className="emoji">🍻</span>
          No hay cuentas abiertas ahora mismo.
          <div className="mt-4">
            <Link to="/cuentas/nueva" className="btn btn-primary"><PlusCircle size={16} /> Abrir la primera cuenta</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3">
          {cuentas.map((c) => (
            <Link key={c.id} to={`/cuentas/${c.id}`} style={{ textDecoration: 'none' }}>
              <div className="ticket">
                <div className="ticket-header">
                  <div>
                    <div className="ticket-cliente">{c.cliente_referencia}</div>
                    <div className="ticket-meta">{tiempoTranscurrido(c.fecha_apertura)}</div>
                  </div>
                  <div className="flex flex-col gap-2" style={{ alignItems: 'flex-end' }}>
                    <span className="badge badge-open">Abierta</span>
                    {c.para_llevar && <span className="badge badge-tipo">Para llevar</span>}
                  </div>
                </div>
                <div className="ticket-total">{formatoCOP.format(c.total)}</div>
                <div className="ticket-meta">Atendió: {c.abierta_por}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
