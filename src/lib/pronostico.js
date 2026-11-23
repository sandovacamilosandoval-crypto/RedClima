// Pronóstico de respaldo (Open-Meteo, gratis y sin clave, uso no comercial).
// Se muestra siempre etiquetado como "Pronóstico", nunca como reporte de la comunidad.
const URL_API = "https://api.open-meteo.com/v1/forecast";

// Códigos WMO → nuestros 8 tipos
export function tipoDesdeWmo(c) {
  if (c === 0) return "soleado";
  if (c === 1 || c === 2) return "parcial";
  if (c === 3) return "nublado";
  if (c === 45 || c === 48) return "niebla";
  if (c >= 51 && c <= 57) return "llovizna";
  if (c === 96 || c === 99) return "granizo";
  if (c >= 95) return "tormenta";
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "lluvia";
  return "nublado";
}

const cache = new Map();

export async function obtenerPronostico(lat, lng) {
  const clave = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const guardado = cache.get(clave);
  if (guardado && Date.now() - guardado.t < 10 * 60 * 1000) return guardado.datos;
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lng.toFixed(3),
    current: "temperature_2m,apparent_temperature,weather_code",
    timezone: "America/Bogota",
  });
  const r = await fetch(`${URL_API}?${params}`);
  if (!r.ok) throw new Error("pronostico");
  const j = await r.json();
  const datos = {
    tipo: tipoDesdeWmo(j.current?.weather_code),
    temperatura: Math.round(j.current?.temperature_2m),
    sensacion: Math.round(j.current?.apparent_temperature),
  };
  cache.set(clave, { t: Date.now(), datos });
  return datos;
}
