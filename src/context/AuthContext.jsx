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
  // Guardamos a qué usuario pertenece el perfil para no mostrar datos de otro.
  // datos: undefined = cargando · null = aún no eligió nombre · objeto = perfil
  // error: fallo al cargar (red, servidor). NO significa "sin perfil".
  const [perfilCargado, setPerfilCargado] = useState({ uid: null, datos: undefined, error: null });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null));
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
      .then((datos) => activo && setPerfilCargado({ uid, datos, error: null }))
      .catch((error) => activo && setPerfilCargado({ uid, datos: undefined, error }));
    return () => {
      activo = false;
    };
  }, [uid, intento]);

  const refrescarPerfil = useCallback(async () => {
    if (!uid) return null;
    const datos = await obtenerPerfil(uid);
    setPerfilCargado({ uid, datos, error: null });
    return datos;
  }, [uid]);

  const reintentarPerfil = useCallback(() => {
    setPerfilCargado((p) => ({ ...p, error: null }));
    setIntento((n) => n + 1);
  }, []);

  // scope "local": solo borra la sesión de este navegador (útil si la cuenta ya no existe)
  const cerrarSesion = useCallback(async (scope = "global") => {
    const { error } = await supabase.auth.signOut({ scope });
    if (error && scope !== "local") await supabase.auth.signOut({ scope: "local" });
  }, []);

  const esDeEsteUsuario = perfilCargado.uid === uid;
  const errorPerfil = session && esDeEsteUsuario ? perfilCargado.error : null;

  let perfil;
  if (session === undefined) perfil = undefined;
  else if (!session) perfil = null;
  else perfil = esDeEsteUsuario ? perfilCargado.datos : undefined;

  return (
    <AuthContext.Provider
      value={{ session, perfil, errorPerfil, reintentarPerfil, refrescarPerfil, cerrarSesion }}
    >
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
