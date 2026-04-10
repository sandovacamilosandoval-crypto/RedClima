import React from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function Terminos() {
  const navigate = useNavigate();

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '600px', textAlign: 'left' }}>
        <h1 className="login-title">Términos de Uso</h1>
        <div style={{ color: '#718096', maxHeight: '400px', overflowY: 'auto', marginBottom: '20px', paddingRight: '10px' }}>
          <p><strong>1. Aceptación:</strong> Al usar RedClima, aceptas reportar el clima de manera honesta.</p>
          <p><strong>2. Contenido de Usuario:</strong> Eres el único responsable de los reportes que generas. El uso indebido de la plataforma (reportes falsos constantes) resultará en la suspensión de la cuenta.</p>
          <p><strong>3. Exclusión de Garantía:</strong> RedClima es una herramienta colaborativa. No garantizamos la precisión al 100% de los datos meteorológicos.</p>
        </div>
        <Button type="primary" className="btn-ver-clima" onClick={() => navigate(-1)}>Volver</Button>
      </div>
    </div>
  );
}