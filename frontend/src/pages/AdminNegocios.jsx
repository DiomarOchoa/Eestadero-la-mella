import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminNegocios() {
  const [negocios, setNegocios] = useState([]);
  const [q, setQ] = useState('');
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(null);

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
    <div className="page">
      <h1>Administración SaaS</h1>
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
            <tr key={n.id}>
              <td>{n.nombre}</td>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
