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

  // 🆕 CAJA
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

  // 🆕 cargar estado caja
  const cargarCaja = async () => {
    try {
      const data = await api.get('/caja');
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

  // 🆕 ELIMINAR
  const eliminarProducto = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;

    try {
      await api.delete(`/productos/${p.id}`);
      toast.success('Producto eliminado');
      await cargar();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 🆕 TOGGLE CAJA
  const toggleCaja = async () => {
    try {
      if (cajaAbierta) {
        await api.post('/caja/cerrar');
        toast.success('Caja cerrada');
      } else {
        await api.post('/caja/abrir');
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
          {/* 🆕 BOTÓN CAJA */}
          <button className="btn btn-outline" onClick={toggleCaja}>
            {cajaAbierta ? 'Cerrar caja' : 'Abrir caja'}
          </button>

          {esAdmin && (
            <button className="btn btn-primary" onClick={abrirNuevo}>
              <PackagePlus size={16} /> Nuevo
            </button>
          )}
        </div>
      </div>

      {formVisible && (
        <div className="card mb-4" style={{ maxWidth: 480 }}>
          <div className="card-title">
            {editando ? 'Editar' : 'Nuevo producto'}
          </div>

          <form onSubmit={guardar}>
            <input
              className="input"
              placeholder="Nombre"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />

            <input
              className="input"
              type="number"
              placeholder="Precio"
              required
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
            />

            <input
              className="input"
              type="number"
              placeholder="Stock"
              required
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />

            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn btn-primary">
                Guardar
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setFormVisible(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {cargando ? (
        <div className="spinner" />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {productos.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{formatoCOP.format(p.precio)}</td>
                <td>{p.stock}</td>

                {esAdmin && (
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditar(p)}>
                        <Pencil size={14} />
                      </button>

                      <button onClick={() => toggleActivo(p)}>
                        <Power size={14} />
                      </button>

                      {/* 🆕 ELIMINAR */}
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
      )}
    </div>
  );
}
