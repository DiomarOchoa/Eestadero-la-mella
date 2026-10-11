import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { suscribirInstalacion, hayInstalacionPendiente, instalarApp } from '../utils/pwa';

const OCULTO_KEY = 'lamella_pwa_banner_oculto';

export default function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [cerrado, setCerrado] = useState(() => {
    try {
      return localStorage.getItem(OCULTO_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => suscribirInstalacion((hay) => setVisible(hay)), []);

  useEffect(() => {
    setVisible(hayInstalacionPendiente());
  }, []);

  if (!visible || cerrado) return null;

  return (
    <div className="pwa-banner" role="region" aria-label="Instalar aplicación">
      <div className="pwa-banner-text">
        <strong>Instala la app del negocio</strong>
        <span>Acceso directo en tu celular, sin Play Store.</span>
      </div>
      <button className="btn btn-primary btn-sm" onClick={() => instalarApp()}>
        <Download size={15} /> Instalar
      </button>
      <button
        className="btn btn-ghost btn-sm"
        aria-label="Cerrar aviso"
        onClick={() => {
          try {
            localStorage.setItem(OCULTO_KEY, '1');
          } catch {}
          setCerrado(true);
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
