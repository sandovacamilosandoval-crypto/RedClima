// Categorías de soporte (deben coincidir con public.ticket_categoria)
export const CATEGORIAS = [
  { value: "bug", emoji: "🐞", label: "Algo no funciona", ayuda: "Cuéntanos qué estabas haciendo y qué pasó." },
  { value: "reporte_falso", emoji: "🚩", label: "Vi un reporte falso", ayuda: "¿Dónde y qué ves realmente? (también puedes tocar la zona en el mapa)" },
  { value: "queja", emoji: "😤", label: "Tengo una queja", ayuda: "Cuéntanos qué te molestó para mejorarlo." },
  { value: "sugerencia", emoji: "💡", label: "Tengo una idea", ayuda: "¿Qué te gustaría que RedClima hiciera?" },
  { value: "duda", emoji: "❓", label: "Tengo una duda", ayuda: "Pregúntanos lo que quieras." },
  { value: "cuenta_privacidad", emoji: "🔒", label: "Mi cuenta o mis datos", ayuda: "Cuéntanos qué necesitas sobre tu cuenta o tu información." },
];

export const CATEGORIA_POR_ID = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c]));

// Cómo ve el usuario cada estado
export const ESTADOS_USUARIO = {
  pendiente: { texto: "Recibido", color: "default" },
  en_revision: { texto: "En revisión", color: "processing" },
  esperando_usuario: { texto: "Te respondimos", color: "warning" },
  resuelto: { texto: "Resuelto", color: "success" },
  cerrado: { texto: "Cerrado", color: "default" },
};
