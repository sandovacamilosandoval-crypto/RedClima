import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';

// Importamos nuestras páginas
import Landing from './pages/Landing';
import Login from './pages/Login';
import UserSetup from './pages/UserSetup'; // Nuevo: Registro de username
import Onboarding from './pages/Onboarding';
import MapPage from './pages/MapPage';
import Terminos from './pages/Terminos';
import Privacidad from './pages/Privacidad';

function App() {
  // SIMULACIÓN DE ESTADOS (Para pruebas de flujo)
  // En el futuro, estos vendrán de tu Backend/Firebase
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#74acff", borderRadius: 12 } }}>
      <Router>
        <Routes>
          {/* Públicas */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />

          {/* Flujo de Registro: Solo accesible si se logueó con Google y es nuevo */}
          <Route 
            path="/registro" 
            element={
              isNewUser ? <UserSetup onComplete={() => setIsNewUser(false)} /> : <Navigate to="/tutorial" />
            } 
          />

          {/* Tutorial: Después del registro o directo si ya tenía cuenta pero no lo ha visto */}
          <Route path="/tutorial" element={<Onboarding />} />

          {/* Destino Final */}
          <Route path="/mapa" element={<MapPage />} />

          {/* Redirección por defecto si la ruta no existe */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;