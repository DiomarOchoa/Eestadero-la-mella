import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, UserRound } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Ajustes() {
  const navigate = useNavigate();
  const toast = useToast();
  const { usuario } = useAuth();

  const [nombre, setNombre] = useState(usuario?.nombreCompleto || '');
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [guardandoClave, setGuardandoClave] = useState(false);

  const guardarPerfil = async (e) => {
    e.preventDefault();
    setError('');
    setGuardandoPerfil(true);
    try {
      await api.patch('/auth/perfil', { nombreCompleto: nombre.trim() });
      toast.success('Nombre actualizado.');
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const cambiarClave = async (e) => {
    e.preventDefault();
    setError('');
    if (nueva !== confirmar) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    setGuardandoClave(true);
    try {
      const data = await api.patch('/auth/password', { actual, nueva });
      toast.success(data.mensaje || 'Contraseña actualizada.');
      setActual('');
      setNueva('');
      setConfirmar('');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoClave(false);
    }
  };

  return (
    <div>
      <button className="back-btn" onClick={() => navigate(-1)} aria-label="Volver atrás">
        <ArrowLeft size={16} /> Atrás
      </button>

      <div className="page-header" style={{ marginTop: 16 }}>
        <div>
          <span className="eyebrow">Cuenta</span>
          <h1>Ajustes</h1>
          <p className="subtitle">Tu perfil y tu contraseña</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="grid grid-cols-2">
        <div className="card">
          <div className="card-title"><UserRound size={16} /> Mi perfil</div>
          <form onSubmit={guardarPerfil}>
            <div className="field">
              <label>Nombre completo</label>
              <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="field">
              <label>Usuario</label>
              <input className="input" value={usuario?.username || ''} disabled />
            </div>
            <button className="btn btn-outline btn-block" type="submit" disabled={guardandoPerfil}>
              {guardandoPerfil ? 'Guardando...' : 'Guardar nombre'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-title"><KeyRound size={16} /> Cambiar contraseña</div>
          <form onSubmit={cambiarClave}>
            <div className="field">
              <label>Contraseña actual</label>
              <input className="input" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
            </div>
            <div className="field">
              <label>Nueva contraseña</label>
              <input className="input" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} required minLength={6} />
            </div>
            <div className="field">
              <label>Confirmar nueva</label>
              <input className="input" type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={6} />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={guardandoClave}>
              {guardandoClave ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
