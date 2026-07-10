import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoorOpen } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function AbrirCuenta() {
  const navigate = useNavigate();
  const toast = useToast();
  const [referencia, setReferencia] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [paraLlevar, setParaLlevar] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (clienteSeleccionado) return; // ya eligió uno, no buscar más
    if (!referencia.trim()) {
      setSugerencias([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get('/clientes', { q: referencia.trim() });
        setSugerencias(data.clientes);
      } catch {
        // fallo silencioso del autocompletado: no bloquea la creación manual
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [referencia, clienteSeleccionado]);

  const elegirSugerencia = (cliente) => {
    setClienteSeleccionado(cliente);
    setReferencia(cliente.referencia);
    setMostrarSugerencias(false);
  };

  const onCambiarReferencia = (valor) => {
    setReferencia(valor);
    setClienteSeleccionado(null);
    setMostrarSugerencias(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!referencia.trim()) {
      setError('Escribe una referencia para el cliente (ej: "Luis", "Mesa 2", "El flaco").');
      return;
    }
    setCargando(true);
    try {
      const payload = clienteSeleccionado
        ? { clienteId: clienteSeleccionado.id, observaciones, paraLlevar }
        : { referencia: referencia.trim(), observaciones, paraLlevar };

      const data = await api.post('/cuentas', payload);
      toast.success(`Cuenta de "${data.cuenta.cliente_referencia}" abierta`);
      navigate(`/cuentas/${data.cuenta.id}`);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Nueva cuenta</span>
          <h1>Abrir cuenta</h1>
          <p className="subtitle">El cliente puede ser un nombre, un apodo o una mesa</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        {error && <div className="form-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="field" style={{ position: 'relative' }}>
            <label htmlFor="referencia">Cliente / referencia</label>
            <input
              id="referencia"
              className="input"
              placeholder='Ej: "Casco negro", "Mesa 2", "Luis"'
              value={referencia}
              onChange={(e) => onCambiarReferencia(e.target.value)}
              onFocus={() => setMostrarSugerencias(true)}
              autoComplete="off"
              autoFocus
              required
            />
            {mostrarSugerencias && sugerencias.length > 0 && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 5,
                  padding: 'var(--space-2)',
                  marginTop: 4,
                }}
              >
                {sugerencias.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => elegirSugerencia(c)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className="text-sm"
                  >
                    {c.referencia}
                  </div>
                ))}
              </div>
            )}
            <span className="text-muted text-sm">
              {clienteSeleccionado
                ? 'Cliente existente seleccionado.'
                : 'Si no existe, se creará automáticamente al abrir la cuenta.'}
            </span>
          </div>

          <div className="field">
            <label htmlFor="obs">Observaciones (opcional)</label>
            <textarea
              id="obs"
              className="input"
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: llegó con dos amigos más"
            />
          </div>

          <div className="field">
            <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={paraLlevar}
                onChange={(e) => setParaLlevar(e.target.checked)}
              />
              <span>Para llevar</span>
            </label>
            <span className="text-muted text-sm">
              Márcalo si el cliente se va a llevar el pedido (no se queda en el local).
            </span>
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={cargando}>
            <DoorOpen size={16} />
            {cargando ? 'Abriendo...' : 'Abrir cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
