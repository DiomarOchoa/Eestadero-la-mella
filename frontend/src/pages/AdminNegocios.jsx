import { Fragment, useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminNegocios() {
  const [negocios, setNegocios] = useState([]);
  const [q, setQ] = useState('');
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [usuariosPorNegocio, setUsuariosPorNegocio] = useState({});
  const [cargandoUsuarios, setCargandoUsuarios] = useState(null);

  const cargar = async () => {
    setError('');
    try {
      const [lista, res] = await Promise.all([
        api.get('/admin/negocios', q ? { q } : {}),
        api.get('/admin/resumen'),
      ]);
      setNegocios(lista.negocios || []);
      setResumen(res.resumen);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternarUsuarios = async (n) => {
    if (expandido === n.id) {
      setExpandido(null);
      return;
    }
    setExpandido(n.id);
    if (usuariosPorNegocio[n.id]) return;
    setCargandoUsuarios(n.id);
    try {
      const data = await api.get(`/admin/negocios/${n.id}/usuarios`);
      setUsuariosPorNegocio((m) => ({ ...m, [n.id]: data.usuarios || [] }));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoUsuarios(null);
    }
  };

  const eliminar = async (n) => {
    const texto = prompt(`Vas a ELIMINAR "${n.nombre}" y TODOS sus datos. Para confirmar escribe su slug: ${n.slug}`, '');
    if (texto === null) return;
    try {
      await api.delete(`/admin/negocios/${n.id}`, { confirmacion: texto });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const actualizar = async (id, cambios) => {
    setGuardando(id);
    try {
      await api.patch(`/admin/negocios/${id}`, cambios);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Dueño SaaS</span>
          <h1>Administración</h1>
          <p className="subtitle">Todos tus negocios en un solo lugar</p>
        </div>
      </div>
      {resumen && (
        <div className="stats">
          <span>Negocios: {resumen.negocios?.total} ({resumen.negocios?.activos} activos)</span>
          {' · '}
          <span>Usuarios activos: {resumen.usuariosActivos}</span>
          {' · '}
          <span>Vendido hoy: {resumen.vendidoHoy}</span>
        </div>
      )}
      <div className="toolbar">
        <input
          className="input"
          placeholder="Buscar por nombre o slug"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && cargar()}
        />
        <button className="btn" onClick={cargar}>Buscar</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Negocio</th>
            <th>Slug</th>
            <th>Plan</th>
            <th>Vence</th>
            <th>Abiertas hoy</th>
            <th>Activo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {negocios.map((n) => (
            <Fragment key={n.id}>
              <tr key={n.id}>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => alternarUsuarios(n)} title="Ver usuarios">
                    {expandido === n.id ? '▾' : '▸'} {n.nombre}
                  </button>
                </td>
              <td>{n.slug}</td>
              <td>
                <select
                  value={n.plan}
                  disabled={guardando === n.id}
                  onChange={(e) => actualizar(n.id, { plan: e.target.value })}
                >
                  <option value="GRATIS">GRATIS</option>
                  <option value="BASICO">BASICO</option>
                  <option value="PRO">PRO</option>
                </select>
              </td>
              <td>{n.suscripcion_vence_en ? String(n.suscripcion_vence_en).slice(0, 10) : '—'}</td>
              <td>{n.cuentas_abiertas}</td>
              <td>
                <input
                  type="checkbox"
                  checked={!!n.activo}
                  disabled={guardando === n.id}
                  onChange={(e) => actualizar(n.id, { activo: e.target.checked })}
                />
              </td>
              <td>
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm"
                    disabled={guardando === n.id}
                    onClick={() => {
                      const dias = prompt('Extender suscripción ¿cuántos días? (ej: 30)', '30');
                      if (!dias) return;
                      // El webhook hace el cálculo; aquí usamos PATCH directo con fecha
                      const base = n.suscripcion_vence_en ? new Date(n.suscripcion_vence_en) : new Date();
                      const d = Number.isNaN(base.getTime()) ? new Date() : base;
                      d.setDate(d.getDate() + Number(dias));
                      actualizar(n.id, { suscripcion_vence_en: d.toISOString().slice(0, 10) });
                    }}
                  >
                    +días
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={guardando === n.id}
                    onClick={() => eliminar(n)}
                    title="Eliminar negocio y todos sus datos"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
              {expandido === n.id && (
                <tr key={`${n.id}-usuarios`}>
                  <td colSpan={7}>
                    {cargandoUsuarios === n.id ? (
                      <div className="spinner" />
                    ) : (usuariosPorNegocio[n.id] || []).length === 0 ? (
                      <span className="text-muted text-sm">Sin usuarios.</span>
                    ) : (
                      <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Usuario</th>
                            <th>Rol</th>
                            <th>Activo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(usuariosPorNegocio[n.id] || []).map((u) => (
                            <tr key={u.id}>
                              <td>{u.nombre_completo}</td>
                              <td className="mono">{u.username}</td>
                              <td><span className="badge badge-tipo">{u.rol}</span></td>
                              <td>{u.activo ? 'Sí' : 'No'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
