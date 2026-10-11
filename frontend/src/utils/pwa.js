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

/** Apunta el manifiesto al negocio actual (PWA con nombre propio por estadero).
 * Se genera como Blob local (mismo origen) porque Chrome rechaza manifiestos
 * cross-origen: el backend da los datos y el frontend arma el manifiesto. */
export function manifiestoParaNegocio(slug) {
  try {
    if (!slug) {
      const link = document.querySelector('link[rel="manifest"]');
      if (link) link.setAttribute('href', '/manifest.json');
      return;
    }
    fetch(`${API_URL}/negocios/${slug}/publico`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const n = data?.negocio;
        if (!n) return;
        const manifest = {
          name: n.nombre,
          short_name: String(n.nombre).slice(0, 12),
          description: `Gestión de cuentas abiertas de ${n.nombre}`,
          start_url: `/?negocio=${n.slug}`,
          scope: '/',
          display: 'standalone',
          background_color: n.tema?.fondo || '#14201A',
          theme_color: n.tema?.fondo || '#14201A',
          orientation: 'portrait-primary',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        };
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        let link = document.querySelector('link[rel="manifest"]');
        if (!link) {
          link = document.createElement('link');
          link.setAttribute('rel', 'manifest');
          document.head.appendChild(link);
        }
        link.setAttribute('href', URL.createObjectURL(blob));
      })
      .catch(() => {});
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
