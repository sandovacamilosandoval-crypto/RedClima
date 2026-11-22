import React, { useState } from "react";
import { App, Button, Input } from "antd";
import { UserOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  USERNAME_CHARS,
  DIAS_BLOQUEO_USERNAME,
  normalizarUsername,
  esUsernameValido,
} from "../constants/clima";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/errores";
import { useAuth } from "../context/AuthContext";
import "./UserSetup.css";

export default function UserSetup() {
  const navigate = useNavigate();
  const { refrescarPerfil } = useAuth();
  const { message } = App.useApp();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const isUsernameValid = esUsernameValido(username);
  const mostrarError = !isUsernameValid && username.length > 0;

  const handleFinish = async () => {
    if (loading) return; // Enter repetido o doble clic
    if (!isUsernameValid) {
      message.error("Revisa las reglas del nombre de usuario");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc("crear_perfil", { p_username: username });
      // "Ya tienes un perfil creado": seguimos al tutorial en vez de quedarnos atascados
      if (error && !/ya tienes un perfil/i.test(error.message ?? "")) {
        message.error(mensajeError(error, "No pudimos crear tu perfil. Inténtalo de nuevo."));
        return;
      }
      await refrescarPerfil();
      navigate("/tutorial", { replace: true });
    } catch (error) {
      message.error(mensajeError(error, "Tu perfil se creó, pero no pudimos cargarlo. Recarga la página."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-icon-wrapper">
          <CheckCircleOutlined className="setup-welcome-icon" />
        </div>

        <h1 className="setup-title">¡Casi listo!</h1>
        <p className="setup-text">
          Para que los demás reconozcan tus reportes, elige un nombre de usuario
          único.
        </p>

        <div className="setup-input-group">
          <label htmlFor="setup-username" className="sr-only">Nombre de usuario</label>
          <Input
            id="setup-username"
            aria-describedby="setup-reglas"
            size="large"
            placeholder="Ej: usuario22"
            prefix={<UserOutlined style={{ color: "#74acff" }} />}
            value={username}
            maxLength={20}
            onChange={(e) => {
              const val = normalizarUsername(e.target.value);
              if (USERNAME_CHARS.test(val)) setUsername(val);
            }}
            onPressEnter={handleFinish}
            className="setup-input"
            status={mostrarError ? "error" : ""}
          />
          <span
            id="setup-reglas"
            className="setup-hint"
            style={{ color: mostrarError ? "#ff4d4f" : "#6b7280" }}
          >
            • Entre 3 y 20 caracteres: letras (a–z), números (0–9) y _ - .
          </span>
          <span className="setup-hint" style={{ color: "#6b7280" }}>
            • No podrás cambiarlo durante {DIAS_BLOQUEO_USERNAME} días.
          </span>
        </div>

        <Button
          type="primary"
          className="setup-btn-continue"
          loading={loading}
          disabled={!isUsernameValid}
          onClick={handleFinish}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
