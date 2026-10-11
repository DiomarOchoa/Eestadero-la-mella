import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, slugInicialNegocio } from '../context/AuthContext';
import { api } from '../api/client';

export default function Login() {
  const { login, negocio } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [negocioSlug, setNegocioSlug] = useState(() => slugInicialNegocio());
  const [negocioPublico, setNegocioPublico] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  // Branding público del negocio (sin auth) para no mostrar siempre "La Mella"
  useEffect(() => {
    const slug = String(negocioSlug || '').trim().toLowerCase();
    if (!slug) {
      setNegocioPublico(null);
      return;
    }
    let cancelado = false;
    // No usamos api.get aquí para evitar el header X-Negocio-Slug en público
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/negocios/${slug}/publico`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelado && data?.negocio) {
          setNegocioPublico(data.negocio);
          if (data.negocio.tema?.acento) {
            document.documentElement.style.setProperty('--color-accent', data.negocio.tema.acento);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [negocioSlug]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(username, password, negocioSlug);
      navigate('/');
    } catch (err) {
      setError(err.message || 'No fue posible iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  const nombreMostrar = negocioPublico?.nombre || negocio?.nombre || 'Tu negocio';

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-sign">{nombreMostrar}</div>
        <div className="login-sub">Acceso privado — solo personal autorizado</div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="negocio">Negocio <span style={{ fontWeight: 400 }}>(solo si te lo pide)</span></label>
            <input
              id="negocio"
              className="input"
              type="text"
              placeholder="lamella"
              autoComplete="organization"
              value={negocioSlug}
              onChange={(e) => {
                setNegocioSlug(e.target.value);
                try {
                  localStorage.setItem('lamella_negocio_slug', e.target.value.trim().toLowerCase());
                } catch {}
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              className="input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={cargando}>
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Link to="/registro">¿Nuevo negocio? Regístralo aquí</Link>
        </div>
      </div>
    </div>
  );
}
