import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import MobileTabBar from './components/MobileTabBar';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CuentasAbiertas from './pages/CuentasAbiertas';
import AbrirCuenta from './pages/AbrirCuenta';
import VistaCuenta from './pages/VistaCuenta';
import Inventario from './pages/Inventario';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';

function Layout({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">{children}</main>
      <MobileTabBar />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cuentas"
          element={
            <ProtectedRoute>
              <Layout><CuentasAbiertas /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cuentas/nueva"
          element={
            <ProtectedRoute>
              <Layout><AbrirCuenta /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cuentas/:id"
          element={
            <ProtectedRoute>
              <Layout><VistaCuenta /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario"
          element={
            <ProtectedRoute>
              <Layout><Inventario /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute>
              <Layout><Reportes /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute soloAdmin>
              <Layout><Usuarios /></Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
