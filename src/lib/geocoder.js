// Buscador de lugares con Photon (OpenStreetMap, gratis y sin clave).
// Solo se envía el texto que escribe el usuario, nunca su ubicación exacta.
const URL_API = "https://photon.komoot.io/api/";
const COLOMBIA = "-79.1,-4.3,-66.8,12.6";

export async function buscarLugares(texto, cerca, senal) {
  const params = new URLSearchParams({ q: texto, limit: "6", bbox: COLOMBIA });
  if (cerca) {
    // sesgo hacia la ciudad del usuario (redondeado a ~10 km)
    params.set("lat", cerca.lat.toFixed(1));
    params.set("lon", cerca.lng.toFixed(1));
  }
  const r = await fetch(`${URL_API}?${params}`, { signal: senal });
  if (!r.ok) throw new Error("buscador");
  const j = await r.json();
  return (j.features ?? []).map((f) => {
    const p = f.properties ?? {};
    const detalle = [p.district, p.city, p.state].filter((x) => x && x !== p.name);
    return {
      id: `${p.osm_type}${p.osm_id}`,
      nombre: p.name ?? p.street ?? "Lugar",
      detalle: [...new Set(detalle)].join(", "),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    };
  });
}
