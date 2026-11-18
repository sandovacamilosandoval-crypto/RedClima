import React from 'react';
import { Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { CLIMA_POR_ID } from '../../constants/clima';
import { haceCuanto } from '../../lib/formato';
import './ZonaClima.css';

// Una zona agregada que viene de la función zonas_cercanas de Supabase
const ZonaClima = ({ zona, ahora }) => {
  if (!zona) return null;

  const clima = CLIMA_POR_ID[zona.tipo] || CLIMA_POR_ID.soleado;
  const posicion = [zona.lat, zona.lng];

  const icono = L.divIcon({
    className: "clima-icon-wrapper",
    html: `
      <div class="zona-clima-container">
        <img src="${clima.img}" alt="${clima.label}" class="clima-icon-animated ${clima.anim}" />
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  return (
    <>
      <Circle
        center={posicion}
        radius={zona.radio_m}
        pathOptions={{
          fillColor: clima.color,
          color: "white",
          weight: 1,
          // Más confianza = color más intenso
          fillOpacity: 0.25 + 0.35 * (zona.confianza ?? 1),
        }}
        className="animacion-pulso"
      />
      <Marker position={posicion} icon={icono}>
        <Popup>
          <strong>{clima.label}</strong>
          <br />
          {zona.reportes} {zona.reportes === 1 ? "reporte" : "reportes"} · {Math.round((zona.confianza ?? 1) * 100)}% de acuerdo
          <br />
          Actualizado {haceCuanto(zona.actualizado_en, ahora)}
        </Popup>
      </Marker>
    </>
  );
};

export default ZonaClima;
