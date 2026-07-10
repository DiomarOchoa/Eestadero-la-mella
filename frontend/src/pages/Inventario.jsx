import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const VACIO = { nombre: '', tipo: 'CERVEZA', precio: '', stock: '', stockMinimo: 5 };

export default function Inventario() {
  const { esAdmin } = useAuth();
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await api.get('/productos');
      setProductos(data.productos);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(VACIO);
    setFormVisible(true);
  };

  const abrirEditar = (p) => {
    setEditando(p);
    setForm({ nombre: p.nombre, tipo: p.tipo, precio: p.precio, stock: p.stock, stockMinimo: p.stock_minimo });
    setFormVisible(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const payload = {
        nombre: form.nombre,
        tipo: form.tipo,
        precio: Number(form.precio),
        stock: Number(form.stock),
        stockMinimo: Number(form.stockMinimo),
      };
      if (editando) {
        await api.patch(`/productos/${editando.id}`, payload);
      } else {
        await api.post('/productos', payload);
      }
      setFormVisible(false);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (p) => {
    try {
      await api.patch(`/productos/${p.id}`, { activo: !p.activo });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Control de stock</span>
          <h1>Inventario</h1>
          <p className="subtitle">Cervezas, bebidas y snacks del estadero</p>
        </div>
        {esAdmin && (
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo producto</button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {formVisible && (
        <div className="card mb-4" style={{ maxWidth: 480 }}>
          <div className="card-title">{editando ? 'Editar producto' : 'Nuevo producto'}</div>
          <form onSubmit={guardar}>
            <div className="field">
              <label>Nombre</label>
              <input className="input" required value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="grid grid-cols-2">
              <div className="field">
                <label>Tipo</label>
                <select className="input" value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="CERVEZA">Cerveza</option>
                  <option value="BEBIDA">Bebida</option>
                  <option value="SNACK">Snack</option>
                </select>
              </div>
              <div className="field">
                <label>Precio (COP)</label>
                <input className="input" type="number" min="0" required value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })} />
              </div>
              <div className="field">
                <label>Stock</label>
                <input className="input" type="number" min="0" required value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="field">
                <label>Stock mínimo (alerta)</label>
                <input className="input" type="number" min="0" required value={form.stockMinimo}
                  onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" className="btn btn-outline" onClick={() => setFormVisible(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
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
                <th>Producto</th>
                <th>Tipo</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
                {esAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td><span className="badge badge-tipo">{p.tipo}</span></td>
                  <td className="mono">{formatoCOP.format(p.precio)}</td>
                  <td className="mono">
                    {p.stock}
                    {p.stock <= p.stock_minimo && (
                      <span className="badge badge-danger" style={{ marginLeft: 8 }}>Bajo</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${p.activo ? 'badge-closed' : 'badge-danger'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {esAdmin && (
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)}>Editar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActivo(p)}>
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
