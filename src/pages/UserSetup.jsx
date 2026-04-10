import React, { useState } from 'react';
import { Button, Input, message } from 'antd';
import { UserOutlined, CheckCircleOutlined } from '@ant-design/icons';
import './UserSetup.css';

export default function UserSetup({ onComplete, userData }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const usernameRegex = /^[a-zA-Z0-9._-]*$/;
  const isUsernameValid = username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9._-]+$/.test(username);

  const handleFinish = () => {
    if (!isUsernameValid) {
      message.error("Revisa las reglas del nombre de usuario");
      return;
    }
    setLoading(true);
    
    setTimeout(() => {
      // GUARDAMOS EL NOMBRE Y LA FECHA ACTUAL (REGISTRO)
      localStorage.setItem("username", username);
      localStorage.setItem("lastChangeDate", new Date().toISOString());
      setLoading(false);
      onComplete(); 
    }, 1500);
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-icon-wrapper">
          <CheckCircleOutlined className="setup-welcome-icon" />
        </div>
        
        <h1 className="setup-title">¡Casi listo!</h1>
        <p className="setup-text">
          Para que los demás reconozcan tus reportes, elige un nombre de usuario único.
        </p>

        <div className="setup-input-group">
          <Input 
            size="large"
            placeholder="Ej: Usuario22" 
            prefix={<UserOutlined style={{ color: '#74acff' }} />} 
            value={username}
            maxLength={20}
            onChange={(e) => {
              const val = e.target.value.toLowerCase().replace(/\s/g, '');
              if (usernameRegex.test(val)) setUsername(val);
            }}
            className="setup-input"
            status={!isUsernameValid && username.length > 0 ? "error" : ""}
          />
          <span className="setup-hint" style={{ color: !isUsernameValid && username.length > 0 ? '#ff4d4f' : '#8c8c8c' }}>
            • Usa de 3-20 caracteres
          </span>
          <span className="setup-hint" style={{ color: !isUsernameValid && username.length > 0 ? '#ff4d4f' : '#8c8c8c' }}>
            • Letras o números.
          </span>
          <span className="setup-hint" style={{ color: !isUsernameValid && username.length > 0 ? '#ff4d4f' : '#8c8c8c' }}>
            • Guion bajo, medio o punto.
          </span>
        </div>

        <Button 
          type="primary" 
          className="setup-btn-continue" 
          loading={loading}
          disabled={!isUsernameValid}
          onClick={handleFinish}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}