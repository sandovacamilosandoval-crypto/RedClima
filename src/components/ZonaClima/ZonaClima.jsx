import React from 'react';
import { Circle, Marker } from 'react-leaflet';
import L from 'leaflet';
import './ZonaClima.css';

// Importación de iconos para los marcadores
import soleadoImg from "../assets/soleado.png";
import lluviaImg from "../assets/lluvia.png";
import nubladoImg from "../assets/nublado.png";
import tormentaImg from "../assets/tormenta.png";

const ZonaClima = ({ reporte }) => {
  // Validación de seguridad
  if (!reporte || !reporte.tipo || !reporte.coords) return null;

  // Configuración de visualización
  const configClima = {
    soleado: { color: "#ffa44e", img: soleadoImg, anim: "anim-soleado" },
    nublado: { color: "#95a5a6", img: nubladoImg, anim: "anim-nublado" },
    lluvia: { color: "#3498db", img: lluviaImg, anim: "anim-lluvia" },
    tormenta: { color: "#2c3e50", img: tormentaImg, anim: "anim-tormenta" }
  };

  const current = configClima[reporte.tipo] || configClima.soleado;
  const radioMetros = reporte.size || 250; 

  // Icono personalizado para el centro
  const customIcon = L.divIcon({
    className: "clima-icon-wrapper",
    html: `
      <div class="zona-clima-container">
        <img src="${current.img}" class="clima-icon-animated ${current.anim}" />
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  return (
    <>
      <Circle
        center={[reporte.coords.lat, reporte.coords.lng]}
        radius={radioMetros}
        pathOptions={{
          fillColor: current.color,
          color: "white",
          weight: 1,
          fillOpacity: 0.5,
        }}
        className="animacion-pulso"
      />
      <Marker 
        position={[reporte.coords.lat, reporte.coords.lng]} 
        icon={customIcon}
        interactive={false}
      />
    </>
  );
};

export default ZonaClima;