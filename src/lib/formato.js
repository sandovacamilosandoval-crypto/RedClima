// Formatos para Colombia (hora de Bogotá)
const formatoFecha = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "short",
  timeStyle: "short",
});

export const formatearFecha = (iso) => formatoFecha.format(new Date(iso));

export function haceCuanto(iso, ahora) {
  const minutos = Math.round((ahora - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "Hace un momento";
  if (minutos < 60) return `Hace ${minutos} min`;
  return `Hace ${Math.round(minutos / 60)} h`;
}
