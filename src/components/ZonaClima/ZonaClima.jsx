import React from 'react';
import { Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { CLIMAS, CLIMA_POR_ID } from '../../constants/clima';
import { haceCuanto } from '../../lib/formato';
import './ZonaClima.css';

// Un icono por tipo de clima, creado una sola vez: si se recreara en cada render
// (el reloj de la página re-renderiza cada 30 s) Leaflet reemplazaría el marcador
// y la animación volvería a empezar.
const ICONOS = Object.fromEntries(
  CLIMAS.map((clima) => [
    clima.id,
    L.divIcon({
      className: "clima-icon-wrapper",
      html: `
        <div class="zona-clima-container">
          <img src="${clima.img}" alt="${clima.label}" class="clima-icon-animated ${clima.anim}" />
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    }),
  ])
);

// Una zona agregada que viene de la función zonas_cercanas de Supabase.
// Al tocarla se ve, ante todo, hace cuántos minutos se reportó.
const ZonaClima = ({ zona, ahora, onDenunciar }) => {
  if (!zona) return null;

  const clima = CLIMA_POR_ID[zona.tipo] || CLIMA_POR_ID.soleado;
  const posicion = [zona.lat, zona.lng];
  const personas = zona.reportes === 1 ? "1 reporte" : `${zona.reportes} reportes`;

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
      <Marker position={posicion} icon={ICONOS[clima.id]} alt={clima.label}>
        <Popup>
          <div className="zona-popup">
            <span className="zona-popup-hace">{haceCuanto(zona.actualizado_en, ahora)}</span>
            <strong className="zona-popup-tipo">{clima.label}</strong>
            <span className="zona-popup-detalle">
              {personas} · {Math.round((zona.confianza ?? 1) * 100)}% de acuerdo
            </span>
            {onDenunciar && (
              <button type="button" className="zona-popup-denunciar" onClick={() => onDenunciar(zona)}>
                🚩 Esto no es cierto
              </button>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
};

export default ZonaClima;
