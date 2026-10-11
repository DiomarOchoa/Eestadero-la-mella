import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function RegistroNegocio() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombreNegocio: '',
    slug: '',
    nombreCompleto: '',
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/negocios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreNegocio: form.nombreNegocio.trim(),
          ...(form.slug.trim() ? { slug: form.slug.trim().toLowerCase() } : {}),
          nombreCompleto: form.nombreCompleto.trim(),
          username: form.username.trim(),
          password: form.password,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.mensaje || `Error (${res.status})`);
      localStorage.setItem('lamella_token', data.token);
      try {
        localStorage.setItem('lamella_negocio_slug', data.negocio.slug);
      } catch {}
      navigate('/');
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-sign">Registra tu negocio</div>
        <div className="login-sub">Crea tu estadero y tu usuario admin en un paso</div>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Nombre del negocio</label>
            <input className="input" value={form.nombreNegocio} onChange={set('nombreNegocio')} required maxLength={120} placeholder="Bar El Rincón" />
          </div>
          <div className="field">
            <label>Identificador (slug, opcional)</label>
            <input className="input" value={form.slug} onChange={set('slug')} placeholder="bar-el-rincon" />
          </div>
          <div className="field">
            <label>Tu nombre completo</label>
            <input className="input" value={form.nombreCompleto} onChange={set('nombreCompleto')} required placeholder="Nombre Completo" />
          </div>
          <div className="field">
            <label>Usuario admin</label>
            <input className="input" value={form.username} onChange={set('username')} required minLength={3} maxLength={50} placeholder="admin" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={6} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={cargando}>
            {cargando ? 'Creando...' : 'Crear negocio'}
          </button>
        </form>
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Link to="/login">Ya tengo cuenta</Link>
        </div>
      </div>
    </div>
  );
}
