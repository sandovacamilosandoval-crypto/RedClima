// Fuente única de verdad para los tipos de clima y reglas compartidas.
import soleado from "../components/assets/soleado.png";
import nublado from "../components/assets/nublado.png";
import lluvia from "../components/assets/lluvia.png";
import tormenta from "../components/assets/tormenta.png";

export const CLIMAS = [
  { id: "soleado", label: "Soleado", img: soleado, color: "#ffa44e", anim: "anim-soleado" },
  { id: "nublado", label: "Nublado", img: nublado, color: "#95a5a6", anim: "anim-nublado" },
  { id: "lluvia", label: "Lluvia", img: lluvia, color: "#3498db", anim: "anim-lluvia" },
  { id: "tormenta", label: "Tormenta", img: tormenta, color: "#2c3e50", anim: "anim-tormenta" },
];

export const CLIMA_POR_ID = Object.fromEntries(CLIMAS.map((c) => [c.id, c]));

// Las reglas de reportes (duración 1 h, 1 reporte cada 10 min, precisión
// máx. 500 m, tamaño de zonas) viven en la base de datos:
// supabase/migrations/20261117000000_esquema_inicial.sql

// Centro del mapa mientras no tengamos tu GPS (Bogotá)
export const UBICACION_DEFECTO = { lat: 4.6097, lng: -74.0817 };
export const RADIO_BUSQUEDA_M = 20000; // zonas visibles alrededor tuyo
export const REFRESCO_ZONAS_MS = 60 * 1000;

// Teselas del mapa. tile.openstreetmap.org NO admite tráfico intenso de apps en
// producción: configura un proveedor con plan (MapTiler, Stadia...) en Vercel.
export const TILES_URL =
  import.meta.env.VITE_TILES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILES_ATRIBUCION =
  import.meta.env.VITE_TILES_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

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
