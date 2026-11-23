import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, Button, ConfigProvider, Result, Spin } from 'antd';
import esES from 'antd/locale/es_ES';

import { AuthProvider, useAuth } from './context/AuthContext';
import { mensajeError } from './lib/errores';
import Landing from './pages/Landing';

// El resto de pantallas se cargan bajo demanda (el mapa con Leaflet es lo más pesado)
const Login = lazy(() => import('./pages/Login'));
const UserSetup = lazy(() => import('./pages/UserSetup'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const MapPage = lazy(() => import('./pages/MapPage'));
const Terminos = lazy(() => import('./pages/Terminos'));
const Privacidad = lazy(() => import('./pages/Privacidad'));
// El panel del equipo va en su propio paquete: los usuarios normales nunca lo descargan
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

function Cargando() {
  return (
    <div style={{ height: '100dvh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Cargando">
      <Spin size="large" />
    </div>
  );
}

// No pudimos leer el perfil (red/servidor): ofrecer reintentar en vez de mandar a /registro
function ErrorPerfil() {
  const { errorPerfil, reintentarPerfil, cerrarSesion } = useAuth();
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <Result
        status="warning"
        title="No pudimos cargar tu perfil"
        subTitle={mensajeError(errorPerfil)}
        extra={[
          <Button key="r" type="primary" onClick={reintentarPerfil}>Reintentar</Button>,
          <Button key="s" onClick={() => cerrarSesion()}>Cerrar sesión</Button>,
        ]}
      />
    </div>
  );
}

// Requiere sesión iniciada Y nombre de usuario elegido
function RequierePerfil({ children }) {
  const { session, perfil, errorPerfil } = useAuth();
  if (errorPerfil) return <ErrorPerfil />;
  if (session === undefined || (session && perfil === undefined)) return <Cargando />;
  if (!session) return <Navigate to="/login" replace />;
  if (!perfil) return <Navigate to="/registro" replace />;
  return children;
}

// Panel: requiere ser del equipo. Es solo la interfaz: la base de datos
// rechaza cualquier consulta del panel si no eres moderador o admin.
function RequiereStaff({ children }) {
  const { session, perfil, rol, errorPerfil } = useAuth();
  if (errorPerfil) return <ErrorPerfil />;
  if (session === undefined || (session && (perfil === undefined || rol === undefined))) return <Cargando />;
  if (!session) return <Navigate to="/login" replace />;
  if (!perfil) return <Navigate to="/registro" replace />;
  if (!rol) return <Navigate to="/mapa" replace />;
  return children;
}

// Registro: requiere sesión, pero aún sin perfil
function RutaRegistro() {
  const { session, perfil, errorPerfil } = useAuth();
  if (errorPerfil) return <ErrorPerfil />;
  if (session === undefined || (session && perfil === undefined)) return <Cargando />;
  if (!session) return <Navigate to="/login" replace />;
  if (perfil) return <Navigate to="/mapa" replace />;
  return <UserSetup />;
}

function App() {
  return (
    <ConfigProvider locale={esES} theme={{ token: { colorPrimary: "#74acff", borderRadius: 12 } }}>
      {/* AntApp da acceso a message/modal con el tema y el idioma (App.useApp) */}
      <AntApp>
        <AuthProvider>
          <Router>
            <Suspense fallback={<Cargando />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/terminos" element={<Terminos />} />
                <Route path="/privacidad" element={<Privacidad />} />
                <Route path="/registro" element={<RutaRegistro />} />
                <Route path="/tutorial" element={<RequierePerfil><Onboarding /></RequierePerfil>} />
                <Route path="/mapa" element={<RequierePerfil><MapPage /></RequierePerfil>} />
                <Route path="/admin/*" element={<RequiereStaff><AdminApp /></RequiereStaff>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Router>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
