import React, { useState } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

import './Onboarding.css';

// Activos
import logoApp from '../components/assets/icono.png';
import gpsImg from '../components/assets/gps.png';
import soleado from '../components/assets/soleado.png';
import nublado from '../components/assets/nublado.png';
import lluvia from '../components/assets/lluvia.png';
import tormenta from '../components/assets/tormenta.png';

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const options = [
    { id: 'soleado', label: 'Soleado', img: soleado },
    { id: 'nublado', label: 'Nublado', img: nublado },
    { id: 'lluvia', label: 'Lluvia', img: lluvia },
    { id: 'tormenta', label: 'Tormenta', img: tormenta },
  ];

  const steps = [
    {
      title: "Tu ubicación es clave",
      text: "Usamos tu GPS para mostrarte el reporte del clima exactamente donde estás ubicado.",
      media: <img src={gpsImg} className="gps-img-step" alt="GPS" />
    },
    {
      title: "Como funciona RedClima",
      text: "Los colores del mapa muestran el clima en cada zona.",
      media: (
        <div className="ob-grid-container">
          {options.map((opt) => (
            <div key={opt.id} className={`ob-grid-item ${opt.id}`}>
              <img src={opt.img} alt={opt.label} />
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      )
    },
    {
      title: "Reporta en un toque",
      text: "Solo elige el icono del clima que ves por tu ventana y compártelo con el resto.",
      media: <img src={logoApp} className="logo-img-step" alt="Logo" />
    }
  ];

  return (
    <div className="ob-screen">
      <div className="ob-card">
        {/* Visual arriba en pasos 1 y 3 */}
        {current !== 1 && <div className="ob-media">{steps[current].media}</div>}

        <h1 className="ob-title">{steps[current].title}</h1>
        <p className="ob-text">{steps[current].text}</p>

        {/* Visual abajo en paso 2 */}
        {current === 1 && <div className="ob-media">{steps[current].media}</div>}

        <div className="ob-dots">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`ob-dot ${i === current ? 'active' : ''}`} />
          ))}
        </div>

        <div className="ob-nav">
          {current > 0 && (
            <Button 
              className="ob-btn-back" 
              onClick={() => setCurrent(current - 1)}
            >
              Atrás
            </Button>
          )}
          
          <Button 
            type="primary" 
            className="ob-btn-next"
            onClick={() => current < 2 ? setCurrent(current + 1) : navigate('/mapa')}
          >
            {current === 2 ? "Comenzar" : "Siguiente"}
          </Button>
        </div>
      </div>
    </div>
  );
}