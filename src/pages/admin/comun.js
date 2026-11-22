// Utilidades compartidas del panel de administración
import { useCallback, useEffect, useState } from "react";
import { createContext, useContext } from "react";
import { supabase } from "../../lib/supabase";

export const PERIODOS = [
  { label: "1 h", value: 1 },
  { label: "12 h", value: 12 },
  { label: "1 día", value: 24 },
  { label: "1 semana", value: 168 },
  { label: "1 mes", value: 720 },
];

export const nombrePeriodo = (horas) =>
  ({ 1: "la última hora", 12: "las últimas 12 horas", 24: "el último día", 168: "la última semana", 720: "el último mes" })[horas] ??
  `las últimas ${horas} h`;

export const ESTADOS_TICKET = {
  pendiente: { texto: "Pendiente", color: "red" },
  en_revision: { texto: "En revisión", color: "processing" },
  esperando_usuario: { texto: "Esperando al usuario", color: "warning" },
  resuelto: { texto: "Resuelto", color: "success" },
  cerrado: { texto: "Cerrado", color: "default" },
};

export const PRIORIDADES = {
  1: { texto: "Baja", color: "default" },
  2: { texto: "Media", color: "blue" },
  3: { texto: "Alta", color: "orange" },
  4: { texto: "Crítica", color: "red" },
};

export const ESTADOS_CUENTA = {
  activo: { texto: "Activo", color: "success" },
  advertido: { texto: "Advertido", color: "warning" },
  suspendido: { texto: "Suspendido", color: "error" },
};

// Llama una función RPC y devuelve { data, error, cargando, recargar }
export function useRpc(nombre, params, activo = true) {
  const clave = JSON.stringify(params ?? {});
  const [estado, setEstado] = useState({ clave: null, data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    supabase.rpc(nombre, JSON.parse(clave)).then(({ data, error }) => {
      if (vigente) setEstado({ clave: `${clave}#${version}`, data, error });
    });
    return () => {
      vigente = false;
    };
  }, [nombre, clave, version, activo]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return {
    data: estado.data,
    error: estado.error,
    cargando: activo && estado.clave !== `${clave}#${version}`,
    recargar,
  };
}

// Abrir la ficha de un usuario desde cualquier vista del panel
export const AdminContext = createContext({ abrirUsuario: () => {} });
export const useAdmin = () => useContext(AdminContext);
