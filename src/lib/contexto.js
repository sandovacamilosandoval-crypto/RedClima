// Datos técnicos que se adjuntan a los casos de soporte para poder
// reproducir un problema sin hacerle preguntas al usuario.
export function contextoApp(extra = {}) {
  return {
    version: import.meta.env.VITE_APP_VERSION,
    ruta: window.location.pathname,
    navegador: navigator.userAgent.slice(0, 200),
    pantalla: `${window.innerWidth}x${window.innerHeight}`,
    en_linea: navigator.onLine,
    ...extra,
  };
}
