import { useEffect, useState } from 'react';
import { Wallet, Lock, Unlock } from 'lucide-react';
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

  useEffect(() => { cargar(); }, []);

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
        observaciones: observaciones || undefined,
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
          <p className="subtitle">Abre al iniciar el turno, cierra al terminar para cuadrar el efectivo</p>
        </div>
      </div>

      {!turno ? (
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="card-title"><Unlock size={16} style={{ marginRight: 6 }} /> Abrir caja</div>
          <form onSubmit={abrir}>
            <div className="field">
              <label>Monto inicial en efectivo</label>
              <input
                className="input"
                type="number"
                min="0"
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
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="card-title"><Wallet size={16} style={{ marginRight: 6 }} /> Caja abierta</div>
          <p className="text-muted text-sm mb-4">
            Abierta el {new Date(turno.fecha_apertura).toLocaleString('es-CO')}<br />
            Monto inicial: <span className="mono">{formatoCOP.format(turno.monto_apertura)}</span>
          </p>

          {!confirmarCierre ? (
            <button className="btn btn-brick btn-block" onClick={() => setConfirmarCierre(true)}>
              <Lock size={16} /> Cerrar caja
            </button>
          ) : (
            <div>
              <div className="field">
                <label>Efectivo contado ahora</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  required
                  value={montoContado}
                  onChange={(e) => setMontoContado(e.target.value)}
                  placeholder="Cuenta el efectivo físico y ponlo aquí"
                />
              </div>
              <div className="field">
                <label>Observaciones (opcional)</label>
                <input
                  className="input"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button className="btn btn-outline" onClick={() => setConfirmarCierre(false)} disabled={procesando}>
                  Cancelar
                </button>
                <button className="btn btn-brick" style={{ flex: 1 }} onClick={cerrar} disabled={procesando || !montoContado}>
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
