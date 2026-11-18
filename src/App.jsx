import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';

import Landing from './pages/Landing';
import Login from './pages/Login';
import UserSetup from './pages/UserSetup';
import Onboarding from './pages/Onboarding';
import MapPage from './pages/MapPage';
import Terminos from './pages/Terminos';
import Privacidad from './pages/Privacidad';

// Protege las rutas que necesitan un usuario registrado.
// TODO: cuando exista autenticación real, validar la sesión (token) en lugar de localStorage.
function RequireUser({ children }) {
  return localStorage.getItem('username') ? children : <Navigate to="/login" replace />;
}

// Si el usuario ya eligió nombre, salta el registro. Se lee en cada render
// (no en un useState) para que funcione tras recargar o cerrar sesión.
function RegistroRoute() {
  const navigate = useNavigate();
  return localStorage.getItem('username')
    ? <Navigate to="/tutorial" replace />
    : <UserSetup onComplete={() => navigate('/tutorial')} />;
}

function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#74acff", borderRadius: 12 } }}>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />

          <Route path="/registro" element={<RegistroRoute />} />

          <Route path="/tutorial" element={<RequireUser><Onboarding /></RequireUser>} />
          <Route path="/mapa" element={<RequireUser><MapPage /></RequireUser>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
