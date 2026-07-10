import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingBag, Store, Minus, Plus, Trash2, Lock } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const TIPO_LABEL = { CERVEZA: 'Cerveza', BEBIDA: 'Bebida', SNACK: 'Snack' };

export default function VistaCuenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmar = useConfirm();

  const [cuenta, setCuenta] = useState(null);
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [agregando, setAgregando] = useState(null); // id del producto en vuelo
  const [filtroTipo, setFiltroTipo] = useState('');
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [cerrando, setCerrando] = useState(false);

  const cargarCuenta = useCallback(async () => {
    const data = await api.get(`/cuentas/${id}`);
    setCuenta(data.cuenta);
  }, [id]);

  const cargarProductos = useCallback(async () => {
    const data = await api.get('/productos', { activo: 'true', tipo: filtroTipo || undefined });
    setProductos(data.productos);
  }, [filtroTipo]);

  useEffect(() => {
    setCargando(true);
    Promise.all([cargarCuenta(), cargarProductos()])
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [cargarCuenta, cargarProductos]);

  const agregarProducto = async (producto) => {
    setError('');
    setAgregando(producto.id);
    try {
      await api.post(`/cuentas/${id}/productos`, { productoId: producto.id, cantidad: 1 });
      await cargarCuenta();
    } catch (err) {
      setError(err.message);
    } finally {
      setAgregando(null);
    }
  };

  const cambiarCantidad = async (item, delta) => {
    const nuevaCantidad = item.cantidad + delta;
    setError('');
    try {
      if (nuevaCantidad <= 0) {
        await api.delete(`/cuentas/${id}/productos/${item.id}`);
      } else {
        await api.patch(`/cuentas/${id}/productos/${item.id}`, { cantidad: nuevaCantidad });
      }
      await cargarCuenta();
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminarItem = async (item) => {
    const confirmado = await confirmar({
      titulo: 'Quitar producto',
      mensaje: `¿Quitar "${item.producto_nombre}" de la cuenta?`,
      textoConfirmar: 'Quitar',
      peligro: true,
    });
    if (!confirmado) return;

    setError('');
    try {
      await api.delete(`/cuentas/${id}/productos/${item.id}`);
      await cargarCuenta();
      toast.info(`"${item.producto_nombre}" quitado de la cuenta`);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  const confirmarCierre = async () => {
    setCerrando(true);
    setError('');
    try {
      await api.post(`/cuentas/${id}/cerrar`, { metodoPago });
      toast.success('Cuenta cerrada correctamente');
      navigate('/cuentas');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      setCerrando(false);
    }
  };

  const toggleParaLlevar = async () => {
    setError('');
    try {
      await api.patch(`/cuentas/${id}`, { paraLlevar: !cuenta.para_llevar });
      await cargarCuenta();
      toast.success(cuenta.para_llevar ? 'Marcada como "en el local"' : 'Marcada como "para llevar"');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  if (cargando) return <div className="spinner" />;
  if (!cuenta) return null;

  const estaAbierta = cuenta.estado === 'ABIERTA';

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Cuenta #{cuenta.id}</span>
          <h1>{cuenta.cliente_referencia}</h1>
          <p className="subtitle">
            Abierta por {cuenta.abierta_por} ·{' '}
            {new Date(cuenta.fecha_apertura).toLocaleString('es-CO')}
          </p>
        </div>
        <div className="flex flex-col gap-2" style={{ alignItems: 'flex-end' }}>
          <span className={`badge ${estaAbierta ? 'badge-open' : 'badge-closed'}`}>
            {estaAbierta ? 'Abierta' : 'Cerrada'}
          </span>
          {cuenta.para_llevar && <span className="badge badge-tipo">Para llevar</span>}
          {estaAbierta && (
            <button className="btn btn-ghost btn-sm" onClick={toggleParaLlevar}>
              {cuenta.para_llevar ? <Store size={14} /> : <ShoppingBag size={14} />}
              {cuenta.para_llevar ? 'Marcar como "en el local"' : 'Marcar como "para llevar"'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="grid grid-cols-2" style={{ alignItems: 'start' }}>
        {/* Detalle de la cuenta */}
        <div className="card">
          <div className="card-title">Consumo</div>
          {cuenta.detalle.length === 0 ? (
            <p className="text-muted text-sm">Aún no se han agregado productos.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Subtotal</th>
                    {estaAbierta && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {cuenta.detalle.map((item) => (
                    <tr key={item.id}>
                      <td>{item.producto_nombre}</td>
                      <td className="mono">
                        {estaAbierta ? (
                          <div className="flex items-center gap-2">
                            <button className="btn btn-ghost btn-sm" onClick={() => cambiarCantidad(item, -1)} aria-label="Restar unidad">
                              <Minus size={14} />
                            </button>
                            {item.cantidad}
                            <button className="btn btn-ghost btn-sm" onClick={() => cambiarCantidad(item, 1)} aria-label="Sumar unidad">
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          item.cantidad
                        )}
                      </td>
                      <td className="mono">{formatoCOP.format(item.subtotal)}</td>
                      {estaAbierta && (
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => eliminarItem(item)}>
                            <Trash2 size={14} />
                            Quitar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between items-center mt-4" style={{ paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
            <span className="text-muted">Total</span>
            <span className="ticket-total" style={{ fontSize: 'var(--fs-xl)' }}>
              {formatoCOP.format(cuenta.total)}
            </span>
          </div>

          {estaAbierta && (
            <div className="mt-4">
              {!mostrarCierre ? (
                <button className="btn btn-brick btn-block" onClick={() => setMostrarCierre(true)}>
                  <Lock size={16} />
                  Cerrar cuenta
                </button>
              ) : (
                <div className="card" style={{ background: 'var(--color-surface-raised)' }}>
                  <div className="field">
                    <label htmlFor="metodo">Método de pago</label>
                    <select
                      id="metodo"
                      className="input"
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                    >
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="TARJETA">Tarjeta</option>
                      <option value="MIXTO">Mixto</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-outline" onClick={() => setMostrarCierre(false)} disabled={cerrando}>
                      Cancelar
                    </button>
                    <button className="btn btn-brick" style={{ flex: 1 }} onClick={confirmarCierre} disabled={cerrando}>
                      {cerrando ? 'Cerrando...' : `Confirmar pago de ${formatoCOP.format(cuenta.total)}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Catálogo rápido para agregar productos */}
        {estaAbierta && (
          <div className="card">
            <div className="card-title">Agregar producto</div>
            <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
              {['', 'CERVEZA', 'BEBIDA', 'SNACK'].map((t) => (
                <button
                  key={t || 'todos'}
                  className={`btn btn-sm ${filtroTipo === t ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFiltroTipo(t)}
                >
                  {t ? TIPO_LABEL[t] : 'Todos'}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {productos.map((p) => (
                <button
                  key={p.id}
                  className="btn btn-outline"
                  style={{ justifyContent: 'space-between' }}
                  onClick={() => agregarProducto(p)}
                  disabled={agregando === p.id || p.stock <= 0}
                >
                  <span>{p.nombre}{p.stock <= 0 ? ' (sin stock)' : ''}</span>
                  <span className="mono">{formatoCOP.format(p.precio)}</span>
                </button>
              ))}
              {productos.length === 0 && (
                <p className="text-muted text-sm">No hay productos para este filtro.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
