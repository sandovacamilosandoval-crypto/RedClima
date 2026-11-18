import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

async function obtenerPerfil(uid) {
  const { data, error } = await supabase.from("perfiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return data; // null si aún no eligió nombre de usuario
}

export function AuthProvider({ children }) {
  // undefined = cargando · null = sin sesión
  const [session, setSession] = useState(undefined);
  // Guardamos a qué usuario pertenece el perfil para no mostrar datos de otro
  const [perfilCargado, setPerfilCargado] = useState({ uid: null, datos: undefined });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id ?? null;

  useEffect(() => {
    if (!uid) return;
    let activo = true;
    obtenerPerfil(uid)
      .then((datos) => activo && setPerfilCargado({ uid, datos }))
      .catch(() => activo && setPerfilCargado({ uid, datos: null }));
    return () => {
      activo = false;
    };
  }, [uid]);

  const refrescarPerfil = useCallback(async () => {
    if (!uid) return null;
    const datos = await obtenerPerfil(uid);
    setPerfilCargado({ uid, datos });
    return datos;
  }, [uid]);

  const cerrarSesion = useCallback(() => supabase.auth.signOut(), []);

  let perfil;
  if (session === undefined) perfil = undefined;
  else if (!session) perfil = null;
  else perfil = perfilCargado.uid === uid ? perfilCargado.datos : undefined;

  return (
    <AuthContext.Provider value={{ session, perfil, refrescarPerfil, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
