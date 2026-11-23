// Niveles por XP. Deben coincidir con public.nivel_de_xp() en
// supabase/migrations/20261122212254_admin_soporte_moderacion.sql
//
// Cada reporte da 10 XP. La barra empieza de cero en cada nivel y el costo
// se duplica en cada nivel: 500 → 1000 → 2000 → 4000 XP (50, 100, 200, 400 reportes).
export const XP_POR_REPORTE = 10;

export const NIVELES = [
  { nivel: 1, nombre: "Observador", desde: 0, color: "#5f6b7a", premio: "Desbloqueas el mapa cada vez que reportas" },
  { nivel: 2, nombre: "Informante", desde: 500, color: "#1d63d6", premio: "Tu insignia de Informante" },
  { nivel: 3, nombre: "Explorador", desde: 1500, color: "#0e8a63", premio: "Tu insignia de Explorador" },
  { nivel: 4, nombre: "Guardián", desde: 3500, color: "#b45309", premio: "Tu insignia de Guardián" },
  { nivel: 5, nombre: "Centinela", desde: 7500, color: "#7c3aed", premio: "Puedes ser elegido reportero verificado" },
];

export function infoNivel(xp = 0) {
  const total = Math.max(0, xp ?? 0);
  let i = 0;
  while (i < NIVELES.length - 1 && total >= NIVELES[i + 1].desde) i++;
  const actual = NIVELES[i];
  const siguiente = NIVELES[i + 1] ?? null;
  if (!siguiente) {
    return { actual, siguiente: null, xpEnNivel: total - actual.desde, xpNecesaria: null, porcentaje: 100, reportesFaltantes: 0 };
  }
  const xpNecesaria = siguiente.desde - actual.desde;
  const xpEnNivel = total - actual.desde;
  return {
    actual,
    siguiente,
    xpEnNivel,
    xpNecesaria,
    porcentaje: Math.min(100, (xpEnNivel / xpNecesaria) * 100),
    reportesFaltantes: Math.ceil((xpNecesaria - xpEnNivel) / XP_POR_REPORTE),
  };
}
