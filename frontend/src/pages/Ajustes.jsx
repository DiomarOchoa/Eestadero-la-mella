import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, UserRound, Palette } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PRESETS_ACENTO = ['#E3A23C', '#C1502E', '#5DA377', '#4F8FE8', '#9B6BE8', '#E86AA0'];
const PRESETS_FONDO = ['#14201A', '#1A1A2E', '#241A12', '#0F2A33', '#2B1215', '#F3EEDF'];

export default function Ajustes() {
  const navigate = useNavigate();
  const toast = useToast();
  const { usuario, negocio, esAdmin } = useAuth();

  const [nombre, setNombre] = useState(usuario?.nombreCompleto || '');
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [guardandoClave, setGuardandoClave] = useState(false);

  const [tema, setTema] = useState({ nombre: '', colorAcento: '', colorFondo: '', logoUrl: '' });
  const [guardandoTema, setGuardandoTema] = useState(false);

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

  const guardarTema = async (e) => {
    e.preventDefault();
    setError('');
    setGuardandoTema(true);
    try {
      await api.patch('/negocios/mio', {
        ...(tema.nombre.trim() ? { nombre: tema.nombre.trim() } : {}),
        colorAcento: tema.colorAcento.trim(),
        colorFondo: tema.colorFondo.trim(),
        logoUrl: tema.logoUrl.trim(),
      });
      toast.success('Apariencia actualizada.');
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoTema(false);
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
          <p className="subtitle">Tu perfil, tu contraseña y la apariencia de {negocio?.nombre || 'tu negocio'}</p>
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

      {esAdmin && (
        <div className="card mt-4">
          <div className="card-title"><Palette size={16} /> Apariencia del negocio</div>
          <form onSubmit={guardarTema}>
            <div className="grid grid-cols-2">
              <div className="field">
                <label>Nombre del negocio</label>
                <input className="input" value={tema.nombre} onChange={(e) => setTema({ ...tema, nombre: e.target.value })} placeholder={negocio?.nombre || ''} maxLength={120} />
              </div>
              <div className="field">
                <label>Logo (opcional, enlace de imagen)</label>
                <div className="flex items-center gap-2">
                  <input className="input" value={tema.logoUrl} onChange={(e) => setTema({ ...tema, logoUrl: e.target.value })} placeholder="https://..." />
                  {tema.logoUrl.trim() && (
                    <img src={tema.logoUrl.trim()} alt="Vista previa del logo" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                </div>
              </div>
              <div className="field">
                <label>Color principal (botones y detalles)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(tema.colorAcento) ? tema.colorAcento : '#E3A23C'}
                    onChange={(e) => setTema({ ...tema, colorAcento: e.target.value })}
                    style={{ width: 46, height: 40, padding: 2, borderRadius: 10, cursor: 'pointer' }}
                  />
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {PRESETS_ACENTO.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => setTema({ ...tema, colorAcento: c })}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                          border: tema.colorAcento.toLowerCase() === c.toLowerCase() ? '2px solid var(--color-text)' : '2px solid transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="field">
                <label>Color de fondo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(tema.colorFondo) ? tema.colorFondo : '#14201A'}
                    onChange={(e) => setTema({ ...tema, colorFondo: e.target.value })}
                    style={{ width: 46, height: 40, padding: 2, borderRadius: 10, cursor: 'pointer' }}
                  />
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {PRESETS_FONDO.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => setTema({ ...tema, colorFondo: c })}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                          border: tema.colorFondo.toLowerCase() === c.toLowerCase() ? '2px solid var(--color-text)' : '2px solid transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button className="btn btn-outline" type="submit" disabled={guardandoTema}>
              {guardandoTema ? 'Guardando...' : 'Guardar apariencia'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
