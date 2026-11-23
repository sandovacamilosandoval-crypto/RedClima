// Embudo de conversión anónimo: un id aleatorio por navegador, sin datos personales.
import { supabase } from "./supabase";

const CLAVE = "redclima:sesion-embudo";

function sesion() {
  try {
    let id = localStorage.getItem(CLAVE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAVE, id);
    }
    return id;
  } catch {
    return null;
  }
}

// landing → clic_ver_mapa → login → registro → primer_reporte (cada paso cuenta una vez)
export function registrarPaso(paso) {
  const id = sesion();
  if (!id) return;
  supabase.rpc("registrar_paso", { p_sesion: id, p_paso: paso }).then(() => {}, () => {});
}
