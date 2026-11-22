import React from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import './Landing.css';

export default function Terminos() {
  const navigate = useNavigate();

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '640px', textAlign: 'left' }}>
        <h1 className="login-title">Términos de Uso</h1>
        <div style={{ color: '#4a5568', maxHeight: '60vh', overflowY: 'auto', marginBottom: '20px', paddingRight: '10px', fontSize: '0.92rem', lineHeight: 1.55 }}>
          <p><strong>1. Aceptación.</strong> Al usar RedClima aceptas estos términos y la Política de Tratamiento de Datos.
            Debes tener al menos 14 años.</p>
          <p><strong>2. Reportes honestos.</strong> Te comprometes a reportar solo el clima que observas en el lugar donde
            estás. Para proteger la calidad de los datos, la app limita a un reporte cada 10 minutos y exige una ubicación
            GPS precisa.</p>
          <p><strong>3. Uso indebido.</strong> Los reportes falsos, automatizados o malintencionados, y los nombres de usuario
            ofensivos, pueden causar la suspensión o eliminación de la cuenta.</p>
          <p><strong>4. Naturaleza de la información.</strong> RedClima es una herramienta colaborativa e informativa. Los datos
            provienen de usuarios y no reemplazan la información oficial del IDEAM ni las alertas de las autoridades. No uses
            RedClima para decisiones de seguridad ante emergencias.</p>
          <p><strong>5. Sin garantía.</strong> El servicio se ofrece "tal cual", sin garantía de disponibilidad continua ni de
            exactitud de los reportes.</p>
          <p><strong>6. Cambios.</strong> Podemos actualizar estos términos; te avisaremos dentro de la app cuando haya cambios
            importantes.</p>
          <p><strong>7. Ley aplicable.</strong> Estos términos se rigen por las leyes de la República de Colombia.</p>
        </div>
        <Button type="primary" className="btn-ver-clima" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/login"))}>Volver</Button>
      </div>
    </div>
  );
}
