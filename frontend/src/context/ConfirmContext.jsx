import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [estado, setEstado] = useState(null); // { titulo, mensaje, textoConfirmar, textoCancelar, peligro }
  const resolverRef = useRef(null);

  const confirmar = useCallback((opciones) => {
    const {
      titulo = '¿Estás seguro?',
      mensaje = '',
      textoConfirmar = 'Confirmar',
      textoCancelar = 'Cancelar',
      peligro = false,
    } = typeof opciones === 'string' ? { mensaje: opciones } : opciones;

    setEstado({ titulo, mensaje, textoConfirmar, textoCancelar, peligro });

    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const cerrar = (resultado) => {
    setEstado(null);
    if (resolverRef.current) {
      resolverRef.current(resultado);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {estado && (
        <div className="confirm-overlay" onClick={() => cerrar(false)}>
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`confirm-icon ${estado.peligro ? 'confirm-icon-danger' : ''}`}>
              {estado.peligro ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
            </div>
            <div className="confirm-titulo" id="confirm-titulo">{estado.titulo}</div>
            {estado.mensaje && <div className="confirm-mensaje">{estado.mensaje}</div>}
            <div className="confirm-acciones">
              <button className="btn btn-outline" onClick={() => cerrar(false)}>
                {estado.textoCancelar}
              </button>
              <button
                className={`btn ${estado.peligro ? 'btn-brick' : 'btn-primary'}`}
                onClick={() => cerrar(true)}
                autoFocus
              >
                {estado.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
}
