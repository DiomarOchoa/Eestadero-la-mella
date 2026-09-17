import { useEffect, useState } from 'react';
import { Wallet, Lock, Unlock, Receipt } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function Caja() {
  const toast = useToast();
  const [turno, setTurno] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [montoApertura, setMontoApertura] = useState('');
  const [montoContado, setMontoContado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await api.get('/caja/actual');
      setTurno(data.turno);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrir = async (e) => {
    e.preventDefault();
    setProcesando(true);
    try {
      await api.post('/caja/abrir', { monto_apertura: Number(montoApertura) });
      toast.success('Caja abierta correctamente');
      setMontoApertura('');
      await cargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const cerrar = async () => {
    setProcesando(true);
    try {
      const data = await api.post(`/caja/${turno.id}/cerrar`, {
        monto_contado: Number(montoContado),
        observaciones: observaciones.trim() || undefined,
      });
      const diferencia = Number(data.turno.diferencia);
      if (diferencia === 0) {
        toast.success('Caja cerrada. Cuadre exacto.');
      } else if (diferencia > 0) {
        toast.success(`Caja cerrada. Sobrante de ${formatoCOP.format(diferencia)}`);
      } else {
        toast.error(`Caja cerrada. Faltante de ${formatoCOP.format(Math.abs(diferencia))}`);
      }
      setMontoContado('');
      setObservaciones('');
      setConfirmarCierre(false);
      await cargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Turno de caja</span>
          <h1>Caja</h1>
          <p className="subtitle">Abre al iniciar el turno y cierra al terminar para cuadrar el efectivo</p>
        </div>
      </div>

      {!turno ? (
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="card-title"><Unlock size={16} style={{ marginRight: 6 }} /> Abrir caja</div>
          <form onSubmit={abrir}>
            <div className="field">
              <label htmlFor="monto-apertura">Monto inicial en efectivo</label>
              <input
                id="monto-apertura"
                className="input"
                type="number"
                min="0"
                step="1"
                required
                value={montoApertura}
                onChange={(e) => setMontoApertura(e.target.value)}
                placeholder="Ej: 50000"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={procesando}>
              {procesando ? 'Abriendo...' : 'Abrir caja'}
            </button>
          </form>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 620 }}>
          <div className="card-title"><Wallet size={16} style={{ marginRight: 6 }} /> Caja abierta</div>
          <p className="text-muted text-sm mb-4">
            Abierta el {new Date(turno.fecha_apertura).toLocaleString('es-CO')}<br />
            Monto inicial: <span className="mono">{formatoCOP.format(turno.monto_apertura)}</span>
          </p>

          <div className="grid grid-cols-3 mb-4">
            <div className="stat-card">
              <div className="stat-label">Ventas</div>
              <div className="stat-value">{turno.ventas_realizadas}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Vendido</div>
              <div className="stat-value" style={{ fontSize: 'var(--fs-md)' }}>
                {formatoCOP.format(turno.total_ventas)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Efectivo esperado</div>
              <div className="stat-value" style={{ fontSize: 'var(--fs-md)' }}>
                {formatoCOP.format(turno.monto_esperado)}
              </div>
            </div>
          </div>

          <div className="text-muted text-sm mb-4">
            <Receipt size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Efectivo: {formatoCOP.format(turno.total_efectivo)} ·
            Transferencia: {formatoCOP.format(turno.total_transferencia)} ·
            Tarjeta: {formatoCOP.format(turno.total_tarjeta)} ·
            Mixto: {formatoCOP.format(turno.total_mixto)}
          </div>

          {!confirmarCierre ? (
            <button className="btn btn-brick btn-block" onClick={() => setConfirmarCierre(true)}>
              <Lock size={16} /> Cerrar caja
            </button>
          ) : (
            <div>
              <div className="field">
                <label htmlFor="monto-contado">Efectivo contado ahora</label>
                <input
                  id="monto-contado"
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={montoContado}
                  onChange={(e) => setMontoContado(e.target.value)}
                  placeholder="Cuenta el efectivo físico y ponlo aquí"
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="observaciones-caja">Observaciones (opcional)</label>
                <input
                  id="observaciones-caja"
                  className="input"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: faltaron $5.000"
                />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-outline" onClick={() => setConfirmarCierre(false)} disabled={procesando}>
                  Cancelar
                </button>
                <button
                  className="btn btn-brick"
                  style={{ flex: 1 }}
                  onClick={cerrar}
                  disabled={procesando || montoContado === ''}
                >
                  {procesando ? 'Cerrando...' : 'Confirmar cierre'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
