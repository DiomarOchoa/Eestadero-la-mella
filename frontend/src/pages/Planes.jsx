import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const WHATSAPP = import.meta.env.VITE_WHATSAPP_VENTAS || '';

const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const DETALLES = {
  GRATIS: ['Hasta 20 productos', 'Cuentas abiertas ilimitadas', 'Reportes básicos'],
  BASICO: ['Hasta 200 productos', 'Caja por turnos y cierres', 'Reportes de ventas y cierre por usuario', 'Soporte por WhatsApp'],
  PRO: ['Productos ilimitados', 'Todo lo del Básico', 'Múltiples usuarios y roles', 'Soporte prioritario'],
};

export default function Planes() {
  const { negocio } = useAuth();
  const [planes, setPlanes] = useState(null);
  const [trialDias, setTrialDias] = useState(14);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/billing/planes`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.planes) {
          setPlanes(d.planes);
          setTrialDias(d.trialDias || 14);
        }
      })
      .catch(() => {});
    const token = localStorage.getItem('lamella_token');
    if (token) {
      fetch(`${API_URL}/billing/estado`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setEstado(d.estado))
        .catch(() => {});
    }
  }, []);

  const planActual = estado?.plan || negocio?.plan;

  const ctaPago = (plan) => {
    const texto = encodeURIComponent(`Hola, soy del negocio ${negocio?.nombre || ''} (${negocio?.slug || ''}) y quiero el plan ${plan}.`);
    if (WHATSAPP) return `${WHATSAPP}?text=${texto}`;
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Suscripción</span>
          <h1>Planes</h1>
          <p className="subtitle">
            {planActual
              ? `Tu plan actual: ${planActual}${estado?.venceEn ? ` · vence ${String(estado.venceEn).slice(0, 10)}` : ''}`
              : `Todos empiezan con ${trialDias} días de PRO gratis, sin tarjeta`}
          </p>
        </div>
        {!negocio && <Link to="/registro" className="btn btn-primary"><Sparkles size={16} /> Empezar prueba gratis</Link>}
      </div>

      {!planes ? (
        <div className="spinner" />
      ) : (
        <div className="grid grid-cols-3">
          {Object.entries(planes).map(([codigo, p]) => {
            const esActual = planActual === codigo;
            const destacado = codigo === 'PRO';
            return (
              <div key={codigo} className="card" style={destacado ? { borderColor: 'var(--color-accent)' } : undefined}>
                <div className="flex justify-between items-center gap-2">
                  <span className="card-title">{p.nombre}</span>
                  {esActual && <span className="badge badge-closed">Tu plan</span>}
                  {!esActual && destacado && <span className="badge badge-open">Recomendado</span>}
                </div>
                <div className="stat-value" style={{ fontSize: '2rem' }}>
                  {p.precio === 0 ? 'Gratis' : `${formatoCOP.format(p.precio)}/mes`}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(DETALLES[codigo] || []).map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm">
                      <Check size={15} color="var(--color-success)" /> {d}
                    </li>
                  ))}
                </ul>
                {!negocio ? (
                  <Link to="/registro" className={`btn btn-block ${destacado ? 'btn-primary' : 'btn-outline'}`}>
                    Empezar {trialDias} días gratis
                  </Link>
                ) : esActual ? (
                  <button className="btn btn-outline btn-block" disabled>Plan activo</button>
                ) : ctaPago(codigo) ? (
                  <a className={`btn btn-block ${destacado ? 'btn-primary' : 'btn-outline'}`} href={ctaPago(codigo)} target="_blank" rel="noreferrer">
                    Elegir {p.nombre}
                  </a>
                ) : (
                  <button className="btn btn-outline btn-block" disabled>Escríbenos para activar</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="login-foot">
        <Link to="/">Volver al inicio</Link>
      </div>
    </div>
  );
}
