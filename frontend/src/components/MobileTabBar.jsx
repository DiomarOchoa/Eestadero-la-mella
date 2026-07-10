import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, PlusCircle, Package } from 'lucide-react';
import './MobileTabBar.css';

export default function MobileTabBar() {
  return (
    <nav className="mobile-tabbar" aria-label="Navegación principal">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        <LayoutDashboard size={22} />
        <span>Inicio</span>
      </NavLink>
      <NavLink to="/cuentas" className={({ isActive }) => (isActive ? 'active' : '')}>
        <Receipt size={22} />
        <span>Cuentas</span>
      </NavLink>
      <NavLink to="/cuentas/nueva" className="mobile-tabbar-fab-link">
        <span className="mobile-tabbar-fab">
          <PlusCircle size={26} />
        </span>
        <span>Abrir</span>
      </NavLink>
      <NavLink to="/inventario" className={({ isActive }) => (isActive ? 'active' : '')}>
        <Package size={22} />
        <span>Stock</span>
      </NavLink>
    </nav>
  );
}
