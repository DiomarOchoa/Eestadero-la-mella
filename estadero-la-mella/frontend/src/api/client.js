const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Cliente HTTP mínimo sobre fetch. Adjunta el token JWT guardado en localStorage
 * y normaliza los errores del backend en un solo formato { mensaje }.
 */
async function request(path, { method = 'GET', body, params } = {}) {
  const token = localStorage.getItem('lamella_token');

  let url = `${API_URL}${path}`;
  if (params) {
    const usp = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    );
    const qs = usp.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // respuesta sin cuerpo JSON
  }

  if (!res.ok) {
    const mensaje = data?.mensaje || `Error de red (${res.status})`;
    const error = new Error(mensaje);
    error.status = res.status;
    error.detalles = data?.detalles;
    throw error;
  }

  return data;
}

export const api = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
