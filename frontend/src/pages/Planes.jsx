import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const WHATSAPP = import.meta.env.VITE_WHATSAPP_VENTAS || '';

const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const DETALLES = {
  GRATIS: ['Hasta 20 productos', 'Cuentas abiertas ilimitadas', 'Reportes básicos'],
  BASICO: ['Hasta 200 productos', 'Caja por turnos y cierres', 'Reportes de ventas y cierre por usuario', 'Soporte por WhatsApp'],
  PRO: ['Productos ilimitados', 'Todo lo del Básico', 'Múltiples usuarios y roles', 'Soporte prioritario'],
};

const ORDEN = ['GRATIS', 'BASICO', 'PRO'];

export default function Planes() {
  const navigate = useNavigate();
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
    if (!WHATSAPP) return null;
    const texto = encodeURIComponent(`Hola, soy del negocio ${negocio?.nombre || ''} (${negocio?.slug || ''}) y quiero el plan ${plan}.`);
    return `${WHATSAPP}?text=${texto}`;
  };

  return (
    <div>
      <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver atrás">
        <ArrowLeft size={16} /> Atrás
      </button>

      <div className="page-header" style={{ marginTop: 16 }}>
        <div>
          <span className="eyebrow"><Crown size={12} /> Suscripción</span>
          <h1>Planes</h1>
          <p className="subtitle">
            {planActual
              ? `Tu plan actual: ${planActual}${estado?.venceEn ? ` · vence ${String(estado.venceEn).slice(0, 10)}` : ''}`
              : `Empieza con ${trialDias} días de PRO gratis, sin tarjeta`}
          </p>
        </div>
        {!negocio && <Link to="/registro" className="btn btn-primary"><Sparkles size={16} /> Empezar prueba gratis</Link>}
      </div>

      {!negocio && (
        <div className="plan-trial-banner">
          <Sparkles size={22} color="var(--color-accent-strong)" />
          <div>
            <strong>Prueba {trialDias} días de PRO sin costo.</strong>
            <div className="text-sm text-muted">Sin tarjeta. Si no te sirve, quedas en plan Gratis automáticamente.</div>
          </div>
        </div>
      )}

      {!planes ? (
        <div className="spinner" />
      ) : (
        <div className="plans-grid">
          {ORDEN.filter((codigo) => planes[codigo]).map((codigo) => {
            const p = planes[codigo];
            const esActual = planActual === codigo;
            const destacado = codigo === 'PRO';
            return (
              <div key={codigo} className={`plan-card${destacado ? ' plan-featured' : ''}`}>
                <div className="plan-top">
                  <span className="plan-name">{p.nombre}</span>
                  {esActual && <span className="badge badge-closed">Tu plan</span>}
                  {!esActual && destacado && <span className="badge badge-open">Más popular</span>}
                </div>
                <div>
                  <span className="plan-price">{p.precio === 0 ? 'Gratis' : formatoCOP.format(p.precio)}</span>
                  {p.precio > 0 && <span className="plan-per"> /mes</span>}
                </div>
                <ul className="plan-features">
                  {(DETALLES[codigo] || []).map((d) => (
                    <li key={d}>
                      <span className="plan-check"><Check size={13} /></span> {d}
                    </li>
                  ))}
                </ul>
                {!negocio ? (
                  <Link to="/registro" className={`btn btn-block ${destacado ? 'btn-primary' : 'btn-outline'}`}>
                    Probar {trialDias} días gratis
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
    </div>
  );
}
