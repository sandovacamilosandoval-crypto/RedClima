import React from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function Privacidad() {
  const navigate = useNavigate();

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '600px', textAlign: 'left' }}>
        <h1 className="login-title">Política de Privacidad</h1>
        <div style={{ color: '#718096', maxHeight: '400px', overflowY: 'auto', marginBottom: '20px', paddingRight: '10px' }}>
          <p><strong>1. Datos de Ubicación:</strong> Solicitamos acceso a tu GPS únicamente para posicionar tus reportes en el mapa de forma anónima para otros usuarios.</p>
          <p><strong>2. Información de Google:</strong> Tu nombre real y correo electrónico son privados. Solo tu usuario elegido será visible para la comunidad.</p>
          <p><strong>3. Seguridad:</strong> Implementamos medidas para proteger tu información y no compartimos tus datos personales con empresas publicitarias.</p>
        </div>
        <Button type="primary" className="btn-ver-clima" onClick={() => navigate(-1)}>Volver</Button>
      </div>
    </div>
  );
}