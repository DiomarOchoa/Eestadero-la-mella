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

  // CAJA
  const [cajaAbierta, setCajaAbierta] = useState(false);

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

  const cargarCaja = async () => {
    try {
      const data = await api.get('/productos/caja'); // ✅ CORREGIDO
      setCajaAbierta(data.abierta);
    } catch {}
  };

  useEffect(() => {
    cargar();
    cargarCaja();
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
        nombre: form.nombre,
        tipo: form.tipo,
        precio: Number(form.precio),
        stock: Number(form.stock),
        stockMinimo: Number(form.stockMinimo),
      };

      if (editando) {
        await api.patch(`/productos/${editando.id}`, payload);
        toast.success(`"${form.nombre}" actualizado`);
      } else {
        await api.post('/productos', payload);
        toast.success(`"${form.nombre}" agregado`);
      }

      setFormVisible(false);
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
      toast.success(p.activo ? 'Desactivado' : 'Activado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const eliminarProducto = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;

    try {
      const res = await api.delete(`/productos/${p.id}`);
      toast.success(res.mensaje || 'Producto eliminado');
      await cargar();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleCaja = async () => {
    try {
      if (cajaAbierta) {
        await api.post('/productos/caja/cerrar'); // ✅ CORREGIDO
        toast.success('Caja cerrada');
      } else {
        await api.post('/productos/caja/abrir'); // ✅ CORREGIDO
        toast.success('Caja abierta');
      }
      cargarCaja();
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

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={toggleCaja}>
            {cajaAbierta ? 'Cerrar caja' : 'Abrir caja'}
          </button>

          {esAdmin && (
            <button className="btn btn-primary" onClick={abrirNuevo}>
              <PackagePlus size={16} /> Nuevo producto
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {formVisible && (
        <div className="card mb-4" style={{ maxWidth: 480 }}>
          <div className="card-title">
            {editando ? 'Editar producto' : 'Nuevo producto'}
          </div>

          <form onSubmit={guardar}>
            <div className="field">
              <label>Nombre</label>
              <input
                className="input"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2">
              <div className="field">
                <label>Tipo</label>
                <select
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
                <label>Precio</label>
                <input
                  className="input"
                  type="number"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Stock</label>
                <input
                  className="input"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Stock mínimo</label>
                <input
                  className="input"
                  type="number"
                  value={form.stockMinimo}
                  onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button type="button" className="btn btn-outline" onClick={() => setFormVisible(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Guardar
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
                  <td>{p.tipo}</td>
                  <td>{formatoCOP.format(p.precio)}</td>
                  <td>{p.stock}</td>
                  <td>{p.activo ? 'Activo' : 'Inactivo'}</td>

                  {esAdmin && (
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => abrirEditar(p)}>
                          <Pencil size={14} />
                        </button>

                        <button onClick={() => toggleActivo(p)}>
                          <Power size={14} />
                        </button>

                        <button onClick={() => eliminarProducto(p)}>
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
