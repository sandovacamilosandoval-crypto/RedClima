import React, { useState } from "react";
import { Button, Input, Select, message, Divider, Progress, Modal, Spin } from "antd";
import {
  UserOutlined,
  HistoryOutlined,
  CustomerServiceOutlined,
  LogoutOutlined,
  ArrowLeftOutlined,
  RightOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import logo from "./assets/icono.png";
import {
  CLIMA_POR_ID,
  USERNAME_CHARS,
  DIAS_BLOQUEO_USERNAME,
  normalizarUsername,
  esUsernameValido,
} from "../constants/clima";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatearFecha } from "../lib/formato";
import "./UserProfileMenu.css";

const NIVELES = [
  { nivel: 1, rango: "Observador", next: 100, color: "#ff4e4e" },
  { nivel: 2, rango: "Informante", next: 1000, color: "#74acff" },
  { nivel: 3, rango: "Explorador", next: 3000, color: "#2c3e50" },
];

const getLevelInfo = (count) =>
  NIVELES.find((n) => count < n.next) || NIVELES[NIVELES.length - 1];

const formatXP = (xp) =>
  xp >= 1000 ? (xp / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(xp);

const UserProfileMenu = ({ onCancel }) => {
  const navigate = useNavigate();
  const { perfil, refrescarPerfil, cerrarSesion } = useAuth();

  const [view, setView] = useState("HUB");
  const [tempUsername, setTempUsername] = useState(perfil?.username ?? "");
  const [guardando, setGuardando] = useState(false);
  // El menú se monta cada vez que se abre, así que esta hora siempre es actual
  const [ahora] = useState(() => Date.now());

  const [historial, setHistorial] = useState(null);

  const [asunto, setAsunto] = useState();
  const [mensaje, setMensaje] = useState("");
  const [enviandoSoporte, setEnviandoSoporte] = useState(false);

  if (!perfil) return null;

  const level = getLevelInfo(perfil.total_reportes);
  const percent = Math.min((perfil.total_reportes / level.next) * 100, 100);

  const isUsernameValid = esUsernameValido(tempUsername);
  const mostrarError = !isUsernameValid && tempUsername.length > 0;
  const diffDays = Math.floor((ahora - new Date(perfil.username_cambiado_en).getTime()) / 86400000);
  const diasRestantes = DIAS_BLOQUEO_USERNAME - diffDays;
  const isButtonDisabled =
    !isUsernameValid || tempUsername === perfil.username || diasRestantes > 0;

  const salir = async () => {
    await cerrarSesion();
    onCancel?.();
    navigate("/", { replace: true });
  };

  const handleSave = async () => {
    setGuardando(true);
    const { error } = await supabase.rpc("cambiar_username", { p_username: tempUsername });
    setGuardando(false);
    if (error) {
      message.error(error.message);
      return;
    }
    await refrescarPerfil();
    message.success("Nombre actualizado");
    setView("HUB");
  };

  const abrirHistorial = async () => {
    setView("HISTORY");
    setHistorial(null);
    const { data, error } = await supabase.rpc("mis_reportes", { p_limite: 50 });
    if (error) {
      message.error("No pudimos cargar tu historial");
      setHistorial([]);
    } else {
      setHistorial(data);
    }
  };

  const enviarSoporte = async () => {
    if (!asunto || mensaje.trim().length < 5) {
      message.warning("Elige un asunto y escribe al menos 5 caracteres");
      return;
    }
    setEnviandoSoporte(true);
    const { error } = await supabase
      .from("mensajes_soporte")
      .insert({ asunto, mensaje: mensaje.trim() });
    setEnviandoSoporte(false);
    if (error) {
      message.error("No pudimos enviar tu mensaje. Inténtalo de nuevo.");
      return;
    }
    message.success("¡Gracias! Recibimos tu mensaje");
    setAsunto(undefined);
    setMensaje("");
    setView("HUB");
  };

  const confirmarBorrarCuenta = () => {
    Modal.confirm({
      title: "¿Borrar tu cuenta?",
      content:
        "Se eliminarán tu perfil, tus reportes y tus mensajes de forma permanente. Esta acción no se puede deshacer.",
      okText: "Sí, borrar todo",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      centered: true,
      onOk: async () => {
        const { error } = await supabase.rpc("borrar_mi_cuenta");
        if (error) {
          message.error("No pudimos borrar tu cuenta. Escríbenos a soporte.");
          return;
        }
        message.success("Tu cuenta y tus datos fueron eliminados");
        await salir();
      },
    });
  };

  const renderHub = () => (
    <div className="menu-hub-container">
      <div className="menu-header-minimal">
        <div className="avatar-mini-img">
          <img src={logo} alt="Logo" className="logo-img" />
        </div>
        <div className="user-info-mini">
          <h3>@{perfil.username}</h3>
          <span className="badge-rango" style={{ color: level.color }}>
            {level.rango} (Niv. {level.nivel})
          </span>
        </div>
      </div>

      <div className="xp-section">
        <div className="xp-labels">
          <span>{formatXP(perfil.xp)} XP</span>
          <span>
            {perfil.total_reportes} / {level.next} reportes
          </span>
        </div>
        <Progress
          percent={percent}
          showInfo={false}
          strokeColor={level.color}
          railColor="#f1f2f6"
          size={{ height: 10 }}
        />
      </div>

      <div className="menu-list">
        <div className="menu-item" onClick={() => setView("PROFILE")}>
          <div className="item-left">
            <UserOutlined /> <span>Mi Perfil</span>
          </div>
          <RightOutlined className="arrow-icon" />
        </div>
        <div className="menu-item" onClick={abrirHistorial}>
          <div className="item-left">
            <HistoryOutlined /> <span>Mis Reportes</span>
          </div>
          <RightOutlined className="arrow-icon" />
        </div>
        <div className="menu-item" onClick={() => setView("SUPPORT")}>
          <div className="item-left">
            <CustomerServiceOutlined /> <span>Soporte</span>
          </div>
          <RightOutlined className="arrow-icon" />
        </div>
      </div>

      <div className="menu-footer-centered">
        <Button className="btn-cerrar-capsula" onClick={onCancel}>
          Cerrar
        </Button>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="menu-subview-container">
      <h2 className="subview-title centered">Mi Perfil</h2>
      <div className="minimal-input-group">
        <label className="input-label">Editar Nombre de Usuario</label>
        <Input
          placeholder="@usuario"
          value={tempUsername}
          maxLength={20}
          className="minimal-input"
          onChange={(e) => {
            const val = normalizarUsername(e.target.value);
            if (USERNAME_CHARS.test(val)) setTempUsername(val);
          }}
          status={mostrarError ? "error" : ""}
        />
        <span
          className="setup-hint"
          style={{ color: mostrarError ? "#ff4d4f" : "#8c8c8c" }}
        >
          • Entre 3 y 20 caracteres: letras (a–z), números (0–9) y _ - .
        </span>
        <span className="setup-hint" style={{ color: "#8c8c8c" }}>
          {diasRestantes > 0
            ? `• Podrás cambiarlo en ${diasRestantes} día(s).`
            : `• Tras cambiarlo, no podrás hacerlo de nuevo en ${DIAS_BLOQUEO_USERNAME} días.`}
        </span>
      </div>
      <Divider />
      <div className="menu-item logout-item-inline" onClick={salir}>
        <div className="item-left">
          <LogoutOutlined /> <span>Cerrar Sesión</span>
        </div>
      </div>
      <div className="menu-item logout-item-inline" onClick={confirmarBorrarCuenta}>
        <div className="item-left" style={{ color: "#ff4d4f" }}>
          <DeleteOutlined /> <span>Borrar mi cuenta y mis datos</span>
        </div>
      </div>
      <div className="dual-buttons-container">
        <Button
          icon={<ArrowLeftOutlined />}
          className="btn-volver-rojo"
          onClick={() => setView("HUB")}
        >
          Volver
        </Button>
        <Button
          type="primary"
          className="btn-action-azul"
          onClick={handleSave}
          loading={guardando}
          disabled={isButtonDisabled}
        >
          Guardar
        </Button>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="menu-subview-container">
      <h2 className="subview-title centered">Mis Reportes</h2>
      <div className="history-table">
        <div className="h-row h-head">
          <span>Coords</span>
          <span>Clima</span>
          <span>Fecha</span>
        </div>
        <div className="h-scroll">
          {historial === null && (
            <div style={{ textAlign: "center", margin: "16px 0" }}>
              <Spin />
            </div>
          )}
          {historial?.length === 0 && (
            <p style={{ textAlign: "center", color: "#8c8c8c", margin: "16px 0" }}>
              Aún no tienes reportes.
            </p>
          )}
          {historial?.map((item) => (
            <div className="h-row" key={item.id}>
              <span className="truncate-text">
                {item.lat.toFixed(3)}, {item.lng.toFixed(3)}
              </span>
              <span>{CLIMA_POR_ID[item.tipo]?.label ?? item.tipo}</span>
              <span>{formatearFecha(item.creado_en)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="menu-footer-centered">
        <Button
          icon={<ArrowLeftOutlined />}
          className="btn-volver-rojo"
          onClick={() => setView("HUB")}
        >
          Volver
        </Button>
      </div>
    </div>
  );

  const renderSupport = () => (
    <div className="menu-subview-container">
      <h2 className="subview-title centered">Soporte</h2>
      <Select
        placeholder="Asunto"
        className="minimal-select"
        style={{ width: "100%" }}
        value={asunto}
        onChange={setAsunto}
        options={[
          { value: "error", label: "Reportar un error" },
          { value: "sugerencia", label: "Sugerencia" },
          { value: "otro", label: "Otro" },
        ]}
      />
      <Input.TextArea
        rows={4}
        maxLength={2000}
        placeholder="Dinos qué sucede..."
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        style={{ marginTop: "15px", borderRadius: "12px" }}
      />
      <div className="dual-buttons-container">
        <Button
          icon={<ArrowLeftOutlined />}
          className="btn-volver-rojo"
          onClick={() => setView("HUB")}
        >
          Volver
        </Button>
        <Button
          type="primary"
          className="btn-action-azul"
          loading={enviandoSoporte}
          onClick={enviarSoporte}
        >
          Enviar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="minimal-menu-wrapper">
      {view === "HUB" && renderHub()}
      {view === "PROFILE" && renderProfile()}
      {view === "HISTORY" && renderHistory()}
      {view === "SUPPORT" && renderSupport()}
    </div>
  );
};

export default UserProfileMenu;
