import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Sun, Moon, LayoutDashboard, Receipt, PlusCircle, Package, BarChart3, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

const LINKS = [
  { to: '/', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cuentas', label: 'Cuentas abiertas', icon: Receipt },
  { to: '/cuentas/nueva', label: 'Abrir cuenta', icon: PlusCircle },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
];

export default function Navbar() {
  const { usuario, logout, esAdmin } = useAuth();
  const { tema, alternarTema } = useTheme();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const salir = () => {
    logout();
    navigate('/login');
  };

  const links = esAdmin ? [...LINKS, { to: '/usuarios', label: 'Usuarios', icon: Users }] : LINKS;

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
              <l.icon size={15} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="navbar-user">
          <button
            className="btn btn-ghost btn-sm navbar-theme-btn"
            onClick={alternarTema}
            aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {tema === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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
            <button className="btn btn-ghost btn-block navbar-theme-btn-drawer" onClick={alternarTema}>
              {tema === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
            <nav className="navbar-drawer-links">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={() => setMenuAbierto(false)}
                >
                  <l.icon size={17} />
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
