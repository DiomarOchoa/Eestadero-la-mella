import { useEffect, useState } from 'react';
import { PackagePlus, Pencil, Power, Trash } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const VACIO = { nombre: '', tipo: 'CERVEZA', precio: '', stock: '', stockMinimo: 5 };

export default function Inventario() {
  const { esAdmin } = useAuth();
  const toast = useToast();

  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const data = await api.get('/productos');
      setProductos(data.productos);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(VACIO);
    setFormVisible(true);
  };

  const abrirEditar = (p) => {
    setEditando(p);
    setForm({
      nombre: p.nombre,
      tipo: p.tipo,
      precio: p.precio,
      stock: p.stock,
      stockMinimo: p.stock_minimo,
    });
    setFormVisible(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');

    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        precio: Number(form.precio),
        stock: Number(form.stock),
        stockMinimo: Number(form.stockMinimo),
      };

      if (!payload.nombre) {
        throw new Error('El nombre del producto es obligatorio.');
      }
      if (!Number.isFinite(payload.precio) || payload.precio < 0) {
        throw new Error('El precio no es válido.');
      }
      if (!Number.isInteger(payload.stock) || payload.stock < 0) {
        throw new Error('El stock debe ser un número entero mayor o igual a 0.');
      }
      if (!Number.isInteger(payload.stockMinimo) || payload.stockMinimo < 0) {
        throw new Error('El stock mínimo debe ser un número entero mayor o igual a 0.');
      }

      if (editando) {
        await api.patch(`/productos/${editando.id}`, payload);
        toast.success(`"${payload.nombre}" actualizado`);
      } else {
        await api.post('/productos', payload);
        toast.success(`"${payload.nombre}" agregado`);
      }

      setFormVisible(false);
      setForm(VACIO);
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (p) => {
    try {
      await api.patch(`/productos/${p.id}`, { activo: !p.activo });
      await cargar();
      toast.success(p.activo ? 'Producto desactivado' : 'Producto activado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const eliminarProducto = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.nombre}"?`)) return;

    try {
      const res = await api.delete(`/productos/${p.id}`);
      toast.success(res.mensaje || 'Producto eliminado');
      await cargar();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Control de stock</span>
          <h1>Inventario</h1>
          <p className="subtitle">Cervezas, bebidas y snacks</p>
        </div>

        {esAdmin && (
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <PackagePlus size={16} /> Nuevo producto
          </button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {formVisible && (
        <div className="card mb-4" style={{ maxWidth: 480 }}>
          <div className="card-title">
            {editando ? 'Editar producto' : 'Nuevo producto'}
          </div>

          <form onSubmit={guardar}>
            <div className="field">
              <label htmlFor="nombre-producto">Nombre</label>
              <input
                id="nombre-producto"
                className="input"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2">
              <div className="field">
                <label htmlFor="tipo-producto">Tipo</label>
                <select
                  id="tipo-producto"
                  className="input"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  <option value="CERVEZA">Cerveza</option>
                  <option value="BEBIDA">Bebida</option>
                  <option value="SNACK">Snack</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="precio-producto">Precio</label>
                <input
                  id="precio-producto"
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="stock-producto">Stock</label>
                <input
                  id="stock-producto"
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>

              <div className="field">
                <label htmlFor="stock-minimo">Stock mínimo</label>
                <input
                  id="stock-minimo"
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.stockMinimo}
                  onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setFormVisible(false);
                  setEditando(null);
                  setForm(VACIO);
                }}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {cargando ? (
        <div className="spinner" />
      ) : productos.length === 0 ? (
        <div className="empty-state card">
          <span className="emoji">📦</span>
          No hay productos registrados.
          {esAdmin && (
            <div className="mt-4">
              <button className="btn btn-primary" onClick={abrirNuevo}>
                <PackagePlus size={16} /> Agregar primer producto
              </button>
            </div>
          )}
        </div>
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
                  <td>{p.tipo}</td>
                  <td>{formatoCOP.format(p.precio)}</td>
                  <td>
                    <span style={{ fontWeight: Number(p.stock) <= Number(p.stock_minimo) ? 700 : 400 }}>
                      {p.stock}
                    </span>
                    {Number(p.stock) <= Number(p.stock_minimo) && (
                      <span className="text-muted text-sm"> · bajo</span>
                    )}
                  </td>
                  <td>{p.activo ? 'Activo' : 'Inactivo'}</td>

                  {esAdmin && (
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)} aria-label={`Editar ${p.nombre}`}>
                          <Pencil size={14} />
                        </button>

                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActivo(p)} aria-label={`${p.activo ? 'Desactivar' : 'Activar'} ${p.nombre}`}>
                          <Power size={14} />
                        </button>

                        <button className="btn btn-ghost btn-sm" onClick={() => eliminarProducto(p)} aria-label={`Eliminar ${p.nombre}`}>
                          <Trash size={14} />
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
