import React, { useEffect, useState } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import logo from '../components/assets/icono.png';
import { supabase } from '../lib/supabase';
import { DURACION_REPORTE_MIN } from '../constants/clima';
import { registrarPaso } from '../lib/embudo';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  // Contador real de la última hora (solo totales, sin ubicaciones)
  const [actividad, setActividad] = useState(null);

  useEffect(() => {
    registrarPaso('landing');
  }, []);

  useEffect(() => {
    let activo = true;
    supabase.rpc('actividad_publica').then(({ data, error }) => {
      if (activo && !error) setActividad(data);
    });
    return () => {
      activo = false;
    };
  }, []);

  const reportes = actividad?.reportes_ultima_hora ?? 0;

  return (
    <div className="landing-container">
      <div className="landing-content">
        <div className="landing-header">
          <img src={logo} alt="" className="landing-logo" />
          <h1 className="landing-title">RedClima</h1>
        </div>

        <div className="landing-hero">
          <p className="landing-subtitle">
            <strong>El clima de tu cuadra, contado por tus vecinos.</strong>
            <br />
            Los pronósticos dicen qué <em>podría</em> pasar en la ciudad. RedClima te dice qué{' '}
            <em>está</em> pasando a pocas cuadras, ahora mismo.
          </p>

          {actividad && (
            <p className="landing-contador" aria-live="polite">
              <span className="landing-pulso" aria-hidden="true" />
              {reportes > 0
                ? `${reportes} ${reportes === 1 ? 'reporte' : 'reportes'} en la última hora`
                : 'Sé de los primeros en reportar hoy'}
            </p>
          )}

          <div className="landing-benefits">
            <div className="benefit-card">
              <h3>Hiperlocal</h3>
              <p>El clima de tu barrio, no el promedio de toda la ciudad.</p>
            </div>
            <div className="benefit-card">
              <h3>Siempre reciente</h3>
              <p>Cada reporte dura {DURACION_REPORTE_MIN} minutos: solo ves lo que pasa ahora.</p>
            </div>
            <div className="benefit-card">
              <h3>Comunidad</h3>
              <p>Vecinos reales confirmando lo que ven por su ventana.</p>
            </div>
          </div>

          <Button
            type="primary"
            className="btn-ver-clima"
            onClick={() => {
              registrarPaso('clic_ver_mapa');
              navigate('/login');
            }}
          >
            Ver el mapa en vivo
          </Button>
          <p className="landing-nota">
            Para ver el mapa, comparte el clima de tu zona: así todos aportamos.
          </p>
        </div>
      </div>
    </div>
  );
}
