// Fuente única de verdad para los tipos de clima y reglas compartidas.
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudLightning, CloudHail } from "lucide";

// 8 tipos, de menos a más intenso. Deben coincidir con public.clima_tipo.
// Cada uno con nombre visible (los iconos solos confunden) y un color distinto.
export const CLIMAS = [
  { id: "soleado", label: "Soleado", icono: Sun, color: "#F2A900" },
  { id: "parcial", label: "Sol y nubes", icono: CloudSun, color: "#F5C451" },
  { id: "nublado", label: "Nublado", icono: Cloud, color: "#8C96A3" },
  { id: "niebla", label: "Neblina", icono: CloudFog, color: "#A99F95" },
  { id: "llovizna", label: "Llovizna", icono: CloudDrizzle, color: "#5DADE2" },
  { id: "lluvia", label: "Lluvia", icono: CloudRain, color: "#2563C9" },
  { id: "tormenta", label: "Tormenta eléctrica", icono: CloudLightning, color: "#6D3FC0" },
  { id: "granizo", label: "Granizo", icono: CloudHail, color: "#0E9AA7" },
];

export const CLIMA_POR_ID = Object.fromEntries(CLIMAS.map((c) => [c.id, c]));

// Las reglas de reportes (duración, 1 reporte cada 10 min, precisión máx.
// 500 m, tamaño de zonas) viven en la base de datos (supabase/migrations).
// Esta constante solo se usa para los textos de la interfaz.
export const DURACION_REPORTE_MIN = 30;

// Centro del mapa mientras no tengamos tu GPS (Bogotá)
export const UBICACION_DEFECTO = { lat: 4.6097, lng: -74.0817 };
export const RADIO_BUSQUEDA_M = 20000; // zonas visibles alrededor del centro del mapa
export const LADO_HEX_M = 500; // tamaño de las zonas hexagonales (centro → vértice)
export const REFRESCO_ZONAS_MS = 60 * 1000;

// Mapa base minimalista: CARTO Positron con la clave gratuita (VITE_CARTO_KEY).
// Sin clave, OpenStreetMap con un filtro suave (clase "mapa-suave").
const CLAVE_CARTO = import.meta.env.VITE_CARTO_KEY;
export const TILES_URL =
  import.meta.env.VITE_TILES_URL ||
  (CLAVE_CARTO
    ? `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CLAVE_CARTO}`
    : "https://tile.openstreetmap.org/{z}/{x}/{y}.png");
// Si Positron falla, el mapa pasa solo a Voyager (formato confirmado por CARTO)
export const TILES_URL_RESPALDO = CLAVE_CARTO
  ? `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CLAVE_CARTO}`
  : null;
export const MAPA_SUAVE = !CLAVE_CARTO && !import.meta.env.VITE_TILES_URL;
export const TILES_ATRIBUCION =
  import.meta.env.VITE_TILES_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' +
    (CLAVE_CARTO ? ' &copy; <a href="https://carto.com/attributions">CARTO</a>' : "");

// Reglas del nombre de usuario (usadas en registro y perfil)
export const USERNAME_CHARS = /^[a-z0-9._-]*$/;
export const DIAS_BLOQUEO_USERNAME = 7;

export const normalizarUsername = (valor) => valor.toLowerCase().replace(/\s/g, "");

export const esUsernameValido = (u) =>
  u.length >= 3 && u.length <= 20 && /^[a-z0-9._-]+$/.test(u);

// Distancia real en metros entre dos coordenadas (fórmula de Haversine)
export function distanciaMetros(a, b) {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
