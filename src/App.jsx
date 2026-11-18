import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import esES from 'antd/locale/es_ES';

import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import UserSetup from './pages/UserSetup';
import Onboarding from './pages/Onboarding';
import MapPage from './pages/MapPage';
import Terminos from './pages/Terminos';
import Privacidad from './pages/Privacidad';

function Cargando() {
  return (
    <div style={{ height: '100dvh', display: 'grid', placeItems: 'center' }}>
      <Spin size="large" />
    </div>
  );
}

// Requiere sesión iniciada Y nombre de usuario elegido
function RequierePerfil({ children }) {
  const { session, perfil } = useAuth();
  if (session === undefined || (session && perfil === undefined)) return <Cargando />;
  if (!session) return <Navigate to="/login" replace />;
  if (!perfil) return <Navigate to="/registro" replace />;
  return children;
}

// Registro: requiere sesión, pero aún sin perfil
function RutaRegistro() {
  const { session, perfil } = useAuth();
  if (session === undefined || (session && perfil === undefined)) return <Cargando />;
  if (!session) return <Navigate to="/login" replace />;
  if (perfil) return <Navigate to="/mapa" replace />;
  return <UserSetup />;
}

function App() {
  return (
    <ConfigProvider locale={esES} theme={{ token: { colorPrimary: "#74acff", borderRadius: 12 } }}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/registro" element={<RutaRegistro />} />
            <Route path="/tutorial" element={<RequierePerfil><Onboarding /></RequierePerfil>} />
            <Route path="/mapa" element={<RequierePerfil><MapPage /></RequierePerfil>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
