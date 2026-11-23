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
  // Rol en el equipo ('moderador' | 'admin' | null). undefined = cargando
  const [rolCargado, setRolCargado] = useState({ uid: null, rol: undefined });
  // Notificaciones sin leer (respuestas de soporte, avisos de moderación)
  const [noLeidas, setNoLeidas] = useState({ total: 0, zonas: 0 });

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

  useEffect(() => {
    if (!uid) return;
    let activo = true;
    supabase
      .rpc("mi_rol")
      .then(({ data, error }) => activo && setRolCargado({ uid, rol: error ? null : data ?? null }));
    return () => {
      activo = false;
    };
  }, [uid]);

  const refrescarNotificaciones = useCallback(async () => {
    if (!uid) return;
    const [todas, zonas] = await Promise.all([
      supabase.from("notificaciones").select("id", { count: "exact", head: true }).eq("leida", false),
      supabase
        .from("notificaciones")
        .select("id", { count: "exact", head: true })
        .eq("leida", false)
        .eq("tipo", "zona_interes"),
    ]);
    if (!todas.error) setNoLeidas({ total: todas.count ?? 0, zonas: zonas.error ? 0 : zonas.count ?? 0 });
  }, [uid]);

  // Revisar cada 2 minutos y al volver a la pestaña
  useEffect(() => {
    if (!uid) return;
    const revisar = () => {
      if (document.visibilityState === "visible") refrescarNotificaciones();
    };
    const primera = setTimeout(revisar, 0);
    const id = setInterval(revisar, 2 * 60 * 1000);
    document.addEventListener("visibilitychange", revisar);
    return () => {
      clearTimeout(primera);
      clearInterval(id);
      document.removeEventListener("visibilitychange", revisar);
    };
  }, [uid, refrescarNotificaciones]);

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

  let rol;
  if (session === undefined) rol = undefined;
  else if (!session) rol = null;
  else rol = rolCargado.uid === uid ? rolCargado.rol : undefined;

  return (
    <AuthContext.Provider
      value={{
        session,
        perfil,
        rol,
        errorPerfil,
        reintentarPerfil,
        refrescarPerfil,
        cerrarSesion,
        // total para el botón del menú; separadas para Soporte y Mis zonas
        noLeidas: session ? noLeidas.total : 0,
        noLeidasZonas: session ? noLeidas.zonas : 0,
        noLeidasSoporte: session ? Math.max(0, noLeidas.total - noLeidas.zonas) : 0,
        refrescarNotificaciones,
      }}
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
