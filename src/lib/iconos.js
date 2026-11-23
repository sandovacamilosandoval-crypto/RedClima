// Iconos de línea (lucide) convertidos a SVG. Son datos estáticos del proyecto,
// nunca texto de usuarios, así que es seguro insertarlos como HTML.
export function svgIcono(nodo, { tamano = 24, color = "currentColor", grosor = 2 } = {}) {
  const hijos = nodo
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${hijos}</svg>`;
}
