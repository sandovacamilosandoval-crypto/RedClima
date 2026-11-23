import React, { useEffect, useState } from "react";
import { App, Button, Checkbox, Spin } from "antd";
import { Link, Navigate } from "react-router-dom";
import logo from "../components/assets/icono.png";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { registrarPaso } from "../lib/embudo";
import "./Login.css";

const CLAVE_ACEPTO = "redclima:acepto-terminos";

// Logo de Google en línea (sin depender de un dominio externo)
const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const leerAcepto = () => {
  try {
    return sessionStorage.getItem(CLAVE_ACEPTO) === "1";
  } catch {
    return false;
  }
};

// Supabase devuelve los errores de OAuth en la query (?error=...) o en el hash (#error=...)
function leerErrorOAuth() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const codigo = query.get("error") || hash.get("error");
  if (!codigo) return null;
  return codigo === "access_denied"
    ? "Cancelaste el inicio de sesión con Google."
    : "No pudimos iniciar sesión con Google. Inténtalo de nuevo.";
}

export default function Login() {
  const { session, perfil, errorPerfil } = useAuth();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(leerAcepto);

  // Mostrar el error que devolvió Google y limpiar la URL
  useEffect(() => {
    const texto = leerErrorOAuth();
    if (texto) {
      message.error(texto);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [message]);

  // Embudo: inició sesión (una vez por navegador)
  useEffect(() => {
    if (session) registrarPaso("login");
  }, [session]);

  // Al volver de Google ya hay sesión: enviar a donde corresponda
  if (session && (perfil || errorPerfil)) return <Navigate to="/mapa" replace />;
  if (session && perfil === null) return <Navigate to="/registro" replace />;
  // Volviendo de Google y aún cargando el perfil: no mostrar el formulario un instante
  if (session === undefined || (session && perfil === undefined)) {
    return (
      <div className="login-container" role="status" aria-label="Cargando">
        <Spin size="large" />
      </div>
    );
  }

  const cambiarAcepto = (valor) => {
    setAccepted(valor);
    try {
      sessionStorage.setItem(CLAVE_ACEPTO, valor ? "1" : "0");
    } catch {
      // sin almacenamiento (modo privado): solo se pierde la casilla marcada
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    if (!accepted) {
      message.warning("Debes aceptar los Términos y la Política de Privacidad");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (error) {
      setLoading(false);
      message.error("No pudimos conectar con Google. Inténtalo de nuevo.");
    }
    // Si no hay error, el navegador se redirige a Google
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src={logo} alt="" className="login-logo-small" />
          <h1 className="login-brand">RedClima</h1>
        </div>

        <p className="login-subtitle">
          Únete a la red para ver y reportar el clima en tiempo real.
        </p>

        <h2 className="login-title">Inicia Sesión</h2>

        <Button
          className={`btn-google ${!accepted ? "is-pendiente" : ""}`}
          loading={loading}
          aria-describedby="login-terminos"
          icon={!loading && <GoogleIcon />}
          onClick={handleGoogleLogin}
        >
          {loading ? "Conectando..." : "Continuar con Google"}
        </Button>

        <div className="login-terms-wrapper">
          <Checkbox
            id="login-terminos"
            checked={accepted}
            onChange={(e) => cambiarAcepto(e.target.checked)}
            className="login-checkbox"
          >
            Acepto los{" "}
            <Link className="link-text" to="/terminos">
              Términos
            </Link>{" "}
            y la{" "}
            <Link className="link-text" to="/privacidad">
              Política de Privacidad
            </Link>
            .
          </Checkbox>
        </div>
        {!accepted && (
          <p className="login-ayuda">Marca la casilla para poder continuar.</p>
        )}
      </div>
    </div>
  );
}
