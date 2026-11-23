import React, { useState } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

import './Onboarding.css';

import logoApp from '../components/assets/icono.png';
import { CLIMAS, DURACION_REPORTE_MIN } from '../constants/clima';
import Icono from '../components/Icono';
import IlustracionUbicacion from '../components/IlustracionUbicacion';

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const steps = [
    {
      title: "Tu ubicación ubica tu reporte",
      text: "Nadie ve dónde estás: el mapa agrupa los reportes en zonas.",
      media: <IlustracionUbicacion />,
    },
    {
      title: "8 tipos de clima",
      text: "Cada zona del mapa muestra el clima que reportan tus vecinos.",
      media: (
        <div className="ob-grid-container">
          {CLIMAS.map((opt) => (
            <div key={opt.id} className="ob-grid-item" style={{ '--clima': opt.color }}>
              <Icono nodo={opt.icono} tamano={20} color={opt.color} />
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Reporta en un toque",
      text: `Tu reporte desbloquea el mapa durante ${DURACION_REPORTE_MIN} minutos y suma XP.`,
      media: <img src={logoApp} width="72" height="72" alt="" />,
    },
  ];

  const ultimo = current === steps.length - 1;

  return (
    <main className="pantalla">
      <div className="tarjeta">
        <div className="ob-arriba">
          <div className="ob-dots" aria-label={`Paso ${current + 1} de ${steps.length}`}>
            {steps.map((_, i) => (
              <span key={i} className={`ob-dot ${i === current ? 'active' : ''}`} />
            ))}
          </div>
          {!ultimo && (
            <button type="button" className="ob-saltar" onClick={() => navigate('/mapa')}>
              Saltar
            </button>
          )}
        </div>

        <div className="ob-media">{steps[current].media}</div>

        <div>
          <h1 className="t-titulo">{steps[current].title}</h1>
          <p className="t-cuerpo" style={{ marginTop: 8 }}>{steps[current].text}</p>
        </div>

        <div className="ob-nav">
          {current > 0 && (
            <Button className="ob-btn-back" onClick={() => setCurrent(current - 1)}>
              Atrás
            </Button>
          )}
          <Button
            type="primary"
            className="btn-principal"
            onClick={() => (ultimo ? navigate('/mapa') : setCurrent(current + 1))}
          >
            {ultimo ? 'Comenzar' : 'Siguiente'}
          </Button>
        </div>
      </div>
    </main>
  );
}
