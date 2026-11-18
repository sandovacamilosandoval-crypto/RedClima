import React from 'react';
import { Circle, Marker } from 'react-leaflet';
import L from 'leaflet';
import { CLIMA_POR_ID, RADIO_ZONA_INICIAL } from '../../constants/clima';
import './ZonaClima.css';

const ZonaClima = ({ reporte }) => {
  if (!reporte || !reporte.tipo || !reporte.coords) return null;

  const current = CLIMA_POR_ID[reporte.tipo] || CLIMA_POR_ID.soleado;
  const radioMetros = reporte.size || RADIO_ZONA_INICIAL;

  // Icono animado en el centro de la zona
  const customIcon = L.divIcon({
    className: "clima-icon-wrapper",
    html: `
      <div class="zona-clima-container">
        <img src="${current.img}" alt="${current.label}" class="clima-icon-animated ${current.anim}" />
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
