import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);
const TOKEN_KEY = 'lamella_token';
const NEGOCIO_KEY = 'lamella_negocio_slug';

function slugDesdeSubdominio() {
  try {
    const host = window.location.hostname; // lamella.tuapp.com -> lamella
    const partes = host.split('.');
    if (partes.length < 3) return null;
    const sub = partes[0].toLowerCase();
    const reservados = new Set(['www', 'api', 'app', 'admin', 'localhost', 'vercel', 'onrender', 'railway']);
    return reservados.has(sub) ? null : sub;
  } catch {
    return null;
  }
}

export function slugInicialNegocio() {
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      slugDesdeSubdominio() ||
      params.get('negocio') ||
      localStorage.getItem(NEGOCIO_KEY) ||
      ''
    );
  } catch {
    return '';
  }
}

function aplicarTema(tema) {
  if (!tema) return;
  const root = document.documentElement;
  if (tema.acento) root.style.setProperty('--color-accent', tema.acento);
  if (tema.fondo) {
    root.style.setProperty('--color-bg', tema.fondo);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', tema.fondo);
  }
}

function limpiarTema() {
  const root = document.documentElement;
  root.style.removeProperty('--color-accent');
  root.style.removeProperty('--color-bg');
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [negocio, setNegocio] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setCargando(false);
      return;
    }
    api
      .get('/auth/me')
      .then((data) => {
        setUsuario(data.usuario);
        setNegocio(data.negocio || null);
        if (data.negocio?.slug) localStorage.setItem(NEGOCIO_KEY, data.negocio.slug);
        aplicarTema(data.negocio?.tema);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setCargando(false));
  }, []);

  const login = useCallback(async (username, password, negocioSlug) => {
    // Solo se usa el slug explícito del campo negocio. Nada de fallback a
    // localStorage: un slug obsoleto guardado causaba "Ese negocio no existe."
    const slug = String(negocioSlug || '').trim().toLowerCase();
    if (!slug) {
      try {
        localStorage.removeItem(NEGOCIO_KEY);
      } catch {}
    }
    let data;
    try {
      data = await api.post('/auth/login', {
        username,
        password,
        ...(slug ? { negocio: slug } : {}),
      });
    } catch (e) {
      // Si el header llevaba un slug viejo y el body iba limpio, reintentar limpio una vez.
      if (!slug && /negocio no existe/i.test(e?.message || '')) {
        try {
          localStorage.removeItem(NEGOCIO_KEY);
        } catch {}
        data = await api.post('/auth/login', { username, password });
      } else {
        throw e;
      }
    }
    localStorage.setItem(TOKEN_KEY, data.token);
    if (data.negocio?.slug) localStorage.setItem(NEGOCIO_KEY, data.negocio.slug);
    setUsuario(data.usuario);
    setNegocio(data.negocio || null);
    // /auth/login no devuelve tema; lo completamos con /auth/me
    try {
      const me = await api.get('/auth/me');
      setNegocio(me.negocio || data.negocio || null);
      aplicarTema(me.negocio?.tema);
    } catch {
      // si falla, seguimos con lo que trajo login
    }
    return data.usuario;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUsuario(null);
    setNegocio(null);
    limpiarTema();
  }, []);

  const esAdmin = usuario?.rol === 'ADMIN' || usuario?.rol === 'SUPERADMIN';
  const esSuperAdmin = usuario?.rol === 'SUPERADMIN';

  return (
    <AuthContext.Provider value={{ usuario, negocio, cargando, login, logout, esAdmin, esSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
