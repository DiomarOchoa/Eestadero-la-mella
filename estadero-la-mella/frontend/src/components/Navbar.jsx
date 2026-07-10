import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { usuario, logout, esAdmin } = useAuth();
  const navigate = useNavigate();

  const salir = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="navbar-mark">🍺</span>
        <span className="navbar-title">La Mella</span>
      </div>

      <nav className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Dashboard
        </NavLink>
        <NavLink to="/cuentas" className={({ isActive }) => (isActive ? 'active' : '')}>
          Cuentas abiertas
        </NavLink>
        <NavLink to="/cuentas/nueva" className={({ isActive }) => (isActive ? 'active' : '')}>
          Abrir cuenta
        </NavLink>
        <NavLink to="/inventario" className={({ isActive }) => (isActive ? 'active' : '')}>
          Inventario
        </NavLink>
        <NavLink to="/reportes" className={({ isActive }) => (isActive ? 'active' : '')}>
          Reportes
        </NavLink>
        {esAdmin && (
          <NavLink to="/usuarios" className={({ isActive }) => (isActive ? 'active' : '')}>
            Usuarios
          </NavLink>
        )}
      </nav>

      <div className="navbar-user">
        <div className="navbar-user-info">
          <span className="navbar-user-name">{usuario?.nombreCompleto}</span>
          <span className="navbar-user-role">{usuario?.rol}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={salir}>
          Salir
        </button>
      </div>
    </header>
  );
}
