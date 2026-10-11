const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

let instalacionPendiente = null;
const oyentes = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    instalacionPendiente = e;
    oyentes.forEach((fn) => fn(true));
  });
  window.addEventListener('appinstalled', () => {
    instalacionPendiente = null;
    oyentes.forEach((fn) => fn(false));
  });
}

export function registrarSW() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

/** Apunta el manifiesto al negocio actual (PWA con nombre propio por estadero). */
export function manifiestoParaNegocio(slug) {
  try {
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'manifest');
      document.head.appendChild(link);
    }
    link.setAttribute(
      'href',
      slug ? `${API_URL}/negocios/${slug}/manifest.json` : '/manifest.json'
    );
  } catch {}
}

export function hayInstalacionPendiente() {
  return !!instalacionPendiente;
}

export function suscribirInstalacion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

export async function instalarApp() {
  if (!instalacionPendiente) return false;
  instalacionPendiente.prompt();
  const { outcome } = await instalacionPendiente.userChoice.catch(() => ({ outcome: 'dismissed' }));
  if (outcome === 'accepted') {
    instalacionPendiente = null;
    oyentes.forEach((fn) => fn(false));
    return true;
  }
  return false;
}
