import React, { useCallback, useState } from "react";
import { App, Button } from "antd";
import { useNavigate } from "react-router-dom";
import { DIAS_BLOQUEO_USERNAME } from "../constants/clima";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/errores";
import { registrarPaso } from "../lib/embudo";
import { useAuth } from "../context/AuthContext";
import CampoUsuario from "../components/CampoUsuario";
import logo from "../components/assets/icono.png";

export default function UserSetup() {
  const navigate = useNavigate();
  const { refrescarPerfil } = useAuth();
  const { message } = App.useApp();
  const [username, setUsername] = useState("");
  const [estado, setEstado] = useState({ valido: false, disponible: null });
  const [loading, setLoading] = useState(false);
  const alEstado = useCallback((e) => setEstado(e), []);

  const listo = estado.valido && estado.disponible === true;

  const handleFinish = async () => {
    if (loading || !listo) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("crear_perfil", { p_username: username });
      // "Ya tienes un perfil creado": seguimos al tutorial en vez de quedarnos atascados
      if (error && !/ya tienes un perfil/i.test(error.message ?? "")) {
        message.error(mensajeError(error, "No pudimos crear tu perfil. Inténtalo de nuevo."));
        return;
      }
      registrarPaso("registro");
      await refrescarPerfil();
      navigate("/tutorial", { replace: true });
    } catch (error) {
      message.error(mensajeError(error, "Tu perfil se creó, pero no pudimos cargarlo. Recarga la página."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pantalla">
      <div className="tarjeta">
        <img src={logo} alt="" width="48" height="48" />
        <div>
          <h1 className="t-titulo">Elige tu nombre</h1>
          <p className="t-cuerpo" style={{ marginTop: 8 }}>Así te reconocerán en la comunidad.</p>
        </div>
        <CampoUsuario id="setup-username" valor={username} onCambio={setUsername} onEstado={alEstado} onEnter={handleFinish} autoFocus />
        <p className="t-xs">No podrás cambiarlo durante {DIAS_BLOQUEO_USERNAME} días.</p>
        <Button type="primary" className="btn-principal" loading={loading} disabled={!listo} onClick={handleFinish}>
          Continuar
        </Button>
      </div>
    </main>
  );
}
