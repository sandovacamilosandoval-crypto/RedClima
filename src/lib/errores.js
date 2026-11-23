// Convierte errores de Supabase / red en mensajes entendibles para el usuario.
// Los errores que lanzamos a propósito desde la base de datos (raise exception)
// llegan con código P0001 y su texto ya está pensado para mostrarse.
export function mensajeError(error, porDefecto = "Algo salió mal. Inténtalo de nuevo.") {
  if (!error) return porDefecto;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Estás sin conexión a internet. Revisa tu conexión e inténtalo de nuevo.";
  }
  if (error.code === "P0001" && error.message) return error.message;

  const texto = `${error.message ?? ""} ${error.details ?? ""} ${error.name ?? ""}`;
  if (/failed to fetch|network|load failed|timeout|aborted/i.test(texto)) {
    return "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.";
  }
  if (error.code === "PGRST301" || error.status === 401 || /jwt|token/i.test(texto)) {
    return "Tu sesión expiró. Vuelve a iniciar sesión.";
  }
  return porDefecto;
}
