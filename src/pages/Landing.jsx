import React, { useEffect, useState } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Users } from 'lucide';
import logo from '../components/assets/icono.png';
import Icono from '../components/Icono';
import { supabase } from '../lib/supabase';
import { DURACION_REPORTE_MIN } from '../constants/clima';
import { registrarPaso } from '../lib/embudo';
import './Landing.css';

const BENEFICIOS = [
  { icono: MapPin, titulo: 'Hiperlocal', texto: 'El clima de tu barrio, no de toda la ciudad.' },
  { icono: Clock, titulo: 'En vivo', texto: `Cada reporte dura ${DURACION_REPORTE_MIN} minutos.` },
  { icono: Users, titulo: 'Comunidad', texto: 'Lo reportan vecinos reales.' },
];

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
    <main className="pantalla">
      <div className="tarjeta landing">
        <div className="landing-marca">
          <img src={logo} alt="" width="40" height="40" />
          <span>RedClima</span>
        </div>

        <div className="landing-hero">
          <h1 className="t-titulo">El clima de tu cuadra, en vivo</h1>
          <p className="t-cuerpo">Lo reportan tus vecinos, no un pronóstico.</p>
        </div>

        {actividad && (
          <p className="landing-contador" aria-live="polite">
            <span className="landing-pulso" aria-hidden="true" />
            {reportes > 0
              ? `${reportes} ${reportes === 1 ? 'reporte' : 'reportes'} en la última hora`
              : 'Sé de los primeros en reportar hoy'}
          </p>
        )}

        <ul className="landing-beneficios">
          {BENEFICIOS.map((b) => (
            <li key={b.titulo}>
              <span className="landing-beneficio-icono">
                <Icono nodo={b.icono} tamano={20} color="#2f6fde" />
              </span>
              <span>
                <strong>{b.titulo}</strong>
                <small>{b.texto}</small>
              </span>
            </li>
          ))}
        </ul>

        <Button
          type="primary"
          className="btn-principal"
          onClick={() => {
            registrarPaso('clic_ver_mapa');
            navigate('/login');
          }}
        >
          Ver el mapa
        </Button>
        <p className="t-xs">Para verlo, comparte el clima de tu zona.</p>
      </div>
    </main>
  );
}
