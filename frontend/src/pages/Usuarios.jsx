import { useEffect, useState } from 'react';
import { UserPlus, Power, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const VACIO = { nombreCompleto: '', username: '', password: '', rol: 'EMPLEADO' };

export default function Usuarios() {
  const { usuario: usuarioActual } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await api.get('/usuarios');
      setUsuarios(data.usuarios);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await api.post('/usuarios', form);
      setForm(VACIO);
      setFormVisible(false);
      await cargar();
      toast.success(`Usuario "${form.nombreCompleto}" creado`);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (u) => {
    try {
      await api.patch(`/usuarios/${u.id}`, { activo: !u.activo });
      await cargar();
      toast.success(u.activo ? `"${u.nombre_completo}" desactivado` : `"${u.nombre_completo}" activado`);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  const eliminar = async (u) => {
    const confirmado = await confirmar({
      titulo: 'Eliminar usuario',
      mensaje: `¿Eliminar a "${u.nombre_completo}" (${u.username})? Esta acción no se puede deshacer.`,
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!confirmado) return;

    setEliminandoId(u.id);
    setError('');
    try {
      await api.delete(`/usuarios/${u.id}`);
      await cargar();
      toast.success(`Usuario "${u.nombre_completo}" eliminado`);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Solo administradores</span>
          <h1>Usuarios</h1>
          <p className="subtitle">Personal con acceso al sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormVisible((v) => !v)}>
          {!formVisible && <UserPlus size={16} />}
          {formVisible ? 'Cancelar' : 'Nuevo usuario'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {formVisible && (
        <div className="card mb-4" style={{ maxWidth: 460 }}>
          <div className="card-title">Nuevo usuario</div>
          <form onSubmit={crear}>
            <div className="field">
              <label>Nombre completo</label>
              <input className="input" required value={form.nombreCompleto}
                onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })} />
            </div>
            <div className="field">
              <label>Usuario</label>
              <input className="input" required value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input className="input" type="password" minLength={6} required value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="field">
              <label>Rol</label>
              <select className="input" value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                <option value="EMPLEADO">Empleado</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={guardando}>
              {guardando ? 'Creando...' : 'Crear usuario'}
            </button>
          </form>
        </div>
      )}

      {cargando ? (
        <div className="spinner" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre_completo}</td>
                  <td className="mono">{u.username}</td>
                  <td><span className="badge badge-tipo">{u.rol}</span></td>
                  <td>
                    <span className={`badge ${u.activo ? 'badge-closed' : 'badge-danger'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleActivo(u)}>
                        <Power size={14} />
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-danger"
                        disabled={u.id === usuarioActual?.id || eliminandoId === u.id}
                        title={u.id === usuarioActual?.id ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
                        onClick={() => eliminar(u)}
                      >
                        <Trash2 size={14} />
                        {eliminandoId === u.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
