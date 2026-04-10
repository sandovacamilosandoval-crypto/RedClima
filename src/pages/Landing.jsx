import React from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
// Corregimos la ruta: sube un nivel (..), entra a components, luego assets
import logo from '../components/assets/icono.png'; 
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="landing-content">
        
        {/* Cabecera con Logo y Título */}
        <div className="landing-header">
          <img src={logo} alt="RedClima Logo" className="landing-logo" />
          <h1 className="landing-title">RedClima</h1>
        </div>

        {/* Hero Section */}
        <div className="landing-hero">
          <p className="landing-subtitle">El clima en tiempo real, reportado por personas como tú.</p>
          
          <div className="landing-benefits">
            <div className="benefit-card">
              <h3>Inmediato</h3>
              <p>Datos frescos al instante.</p>
            </div>
            <div className="benefit-card">
              <h3>Comunidad</h3>
              <p>Reportes de vecinos reales.</p>
            </div>
            <div className="benefit-card">
              <h3>Precisión</h3>
              <p>Zonas climáticas exactas.</p>
            </div>
          </div>

          <Button 
            type="primary" 
            className="btn-ver-clima" 
            onClick={() => navigate('/login')}
          >
            Ver clima
          </Button> 
        </div>
      </div>
    </div>
  );
}