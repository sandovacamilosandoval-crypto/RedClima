import React, { useMemo } from 'react';
import { Polygon, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { CLIMAS, CLIMA_POR_ID, LADO_HEX_M } from '../../constants/clima';
import { haceCuanto } from '../../lib/formato';
import { svgIcono } from '../../lib/iconos';
import './ZonaClima.css';

// Un icono por tipo, creado una sola vez (si se recreara en cada render,
// Leaflet reemplazaría el marcador cada 30 s)
const ICONOS = Object.fromEntries(
  CLIMAS.map((c) => [
    c.id,
    L.divIcon({
      className: 'zona-icono-wrapper',
      html: `<div class="zona-icono" style="--clima:${c.color}">${svgIcono(c.icono, { tamano: 20, color: c.color, grosor: 2.2 })}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -16],
    }),
  ])
);

// Vértices del hexágono (puntiagudo arriba) alrededor de su centro, en Web Mercator,
// igual que lo calcula la base de datos (public._hex)
const R = 6378137;
function vertices(lat, lng, lado) {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    const vx = x + lado * Math.cos(a);
    const vy = y + lado * Math.sin(a);
    return [((2 * Math.atan(Math.exp(vy / R)) - Math.PI / 2) * 180) / Math.PI, (vx / R) * (180 / Math.PI)];
  });
}

// Una zona de la comunidad. Las de 30–60 min ("último dato") se ven atenuadas.
const ZonaClima = ({ zona, ahora, onDenunciar }) => {
  const clima = CLIMA_POR_ID[zona.tipo] || CLIMA_POR_ID.nublado;
  const reciente = zona.reciente !== false;
  const puntos = useMemo(() => vertices(zona.lat, zona.lng, zona.radio_m || LADO_HEX_M), [zona.lat, zona.lng, zona.radio_m]);
  const personas = zona.reportes === 1 ? '1 persona' : `${zona.reportes} personas`;

  return (
    <>
      <Polygon
        positions={puntos}
        pathOptions={{
          fillColor: clima.color,
          // más acuerdo = color más intenso; el último dato, muy tenue
          fillOpacity: reciente ? 0.22 + 0.3 * (zona.confianza ?? 1) : 0.12,
          color: clima.color,
          opacity: reciente ? 0.9 : 0.5,
          weight: reciente ? 1.5 : 1,
          dashArray: reciente ? undefined : '4 4',
        }}
        className="zona-hex"
      />
      <Marker position={[zona.lat, zona.lng]} icon={ICONOS[clima.id]} alt={clima.label} opacity={reciente ? 1 : 0.6}>
        <Popup>
          <div className="zona-popup">
            <span className="zona-popup-hace">{haceCuanto(zona.actualizado_en, ahora)}</span>
            <strong className="zona-popup-tipo">{clima.label}</strong>
            <span className="zona-popup-detalle">
              {personas} · {Math.round((zona.confianza ?? 1) * 100)}% de acuerdo
            </span>
            {!reciente && <span className="zona-popup-viejo">Último dato conocido: puede haber cambiado</span>}
            {onDenunciar && reciente && (
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
