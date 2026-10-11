import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, soloAdmin = false, soloSuper = false }) {
  const { usuario, cargando, esAdmin, esSuperAdmin } = useAuth();

  if (cargando) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && !esAdmin) return <Navigate to="/" replace />;
  if (soloSuper && !esSuperAdmin) return <Navigate to="/" replace />;

  return children;
}
