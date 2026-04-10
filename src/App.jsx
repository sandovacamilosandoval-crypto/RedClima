import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';

import Landing from './pages/Landing';
import Login from './pages/Login';
import UserSetup from './pages/UserSetup';
import Onboarding from './pages/Onboarding';
import MapPage from './pages/MapPage';
import Terminos from './pages/Terminos';
import Privacidad from './pages/Privacidad';

function App() {
  const [isNewUser, setIsNewUser] = useState(true);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#74acff", borderRadius: 12 } }}>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />

          <Route
            path="/registro"
            element={
              isNewUser ? <UserSetup onComplete={() => setIsNewUser(false)} /> : <Navigate to="/tutorial" />
            }
          />

          <Route path="/tutorial" element={<Onboarding />} />
          <Route path="/mapa" element={<MapPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
