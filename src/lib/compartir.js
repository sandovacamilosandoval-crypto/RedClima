// Invitar a otras personas (menú de compartir del celular o copiar el enlace)
export async function compartirRedClima() {
  const datos = {
    title: "RedClima",
    text: "Estoy reportando el clima de mi zona en RedClima. ¡Súmate para que el mapa de nuestro barrio tenga más datos!",
    url: window.location.origin,
  };
  try {
    if (navigator.share) {
      await navigator.share(datos);
      return "compartido";
    }
    await navigator.clipboard.writeText(`${datos.text} ${datos.url}`);
    return "copiado";
  } catch (e) {
    return e?.name === "AbortError" ? "cancelado" : "error";
  }
}
