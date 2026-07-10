import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONOS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const quitar = useCallback((id) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const mostrar = useCallback((mensaje, opciones = {}) => {
    const { tipo = 'success', duracion = 3500 } = opciones;
    const id = ++idCounter;
    setToasts((t) => [...t, { id, mensaje, tipo }]);
    timers.current[id] = setTimeout(() => quitar(id), duracion);
    return id;
  }, [quitar]);

  const toast = {
    success: (msg, opts) => mostrar(msg, { ...opts, tipo: 'success' }),
    error: (msg, opts) => mostrar(msg, { ...opts, tipo: 'error' }),
    info: (msg, opts) => mostrar(msg, { ...opts, tipo: 'info' }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icono = ICONOS[t.tipo] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.tipo}`}>
              <Icono size={18} className="toast-icon" />
              <span className="toast-msg">{t.mensaje}</span>
              <button className="toast-close" onClick={() => quitar(t.id)} aria-label="Cerrar notificación">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
