import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const LINKS = [
  { to: '/', end: true, label: 'Dashboard' },
  { to: '/cuentas', label: 'Cuentas abiertas' },
  { to: '/cuentas/nueva', label: 'Abrir cuenta' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/reportes', label: 'Reportes' },
];

export default function Navbar() {
  const { usuario, logout, esAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const salir = () => {
    logout();
    navigate('/login');
  };

  const links = esAdmin ? [...LINKS, { to: '/usuarios', label: 'Usuarios' }] : LINKS;

  return (
    <>
      <header className="navbar">
        <button
          className="navbar-menu-btn"
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>

        <div className="navbar-brand">
          <span className="navbar-mark">🍺</span>
          <span className="navbar-title">La Mella</span>
        </div>

        <nav className="navbar-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
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

      {/* Drawer / menú lateral para móvil */}
      {menuAbierto && (
        <div className="navbar-drawer-overlay" onClick={() => setMenuAbierto(false)}>
          <div className="navbar-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="navbar-drawer-header">
              <div>
                <div className="navbar-user-name">{usuario?.nombreCompleto}</div>
                <div className="navbar-user-role">{usuario?.rol}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">
                <X size={20} />
              </button>
            </div>
            <nav className="navbar-drawer-links">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={() => setMenuAbierto(false)}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <button className="btn btn-brick btn-block" onClick={salir}>
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      )}
    </>
  );
}
