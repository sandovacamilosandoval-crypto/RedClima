import React, { useState } from "react";
import { Button, Input, Select, message, Divider, Progress } from "antd";
import {
  UserOutlined,
  HistoryOutlined,
  CustomerServiceOutlined,
  LogoutOutlined,
  ArrowLeftOutlined,
  RightOutlined,
  StarFilled,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import logo from "./assets/icono.png";
import {
  USERNAME_CHARS,
  DIAS_BLOQUEO_USERNAME,
  normalizarUsername,
  esUsernameValido,
} from "../constants/clima";
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

const UserProfileMenu = ({ onCancel, userFromLogin = "Invitado" }) => {
  const navigate = useNavigate();
  const [view, setView] = useState("HUB");
  const [currentUsername, setCurrentUsername] = useState(userFromLogin);
  const [tempUsername, setTempUsername] = useState(userFromLogin);

  // Se leen al montar; MapPage desmonta el menú al cerrarlo, así que siempre están frescos
  const [userXP] = useState(() => parseInt(localStorage.getItem("user_xp") || "0", 10));
  const [reportCount] = useState(() =>
    parseInt(localStorage.getItem("user_reports_count") || "0", 10),
  );

  const level = getLevelInfo(reportCount);
  const percent = Math.min((reportCount / level.next) * 100, 100);

  const [lastChangeDate] = useState(() => {
    const savedDate = localStorage.getItem("lastChangeDate");
    return savedDate ? new Date(savedDate) : new Date();
  });

  const isUsernameValid = esUsernameValido(tempUsername);
  const mostrarError = !isUsernameValid && tempUsername.length > 0;

  const diffDays = Math.floor(
    Math.abs(new Date() - lastChangeDate) / (1000 * 60 * 60 * 24),
  );
  const diasRestantes = DIAS_BLOQUEO_USERNAME - diffDays;
  const isButtonDisabled =
    !isUsernameValid || tempUsername === currentUsername || diasRestantes > 0;

  const handleLogout = () => {
    // TODO: cuando exista autenticación real, cerrar también la sesión en el servidor
    ["username", "lastChangeDate"].forEach((k) => localStorage.removeItem(k));
    message.info("Sesión cerrada");
    onCancel?.();
    navigate("/", { replace: true });
  };

  const handleSave = () => {
    if (diasRestantes > 0 && tempUsername !== currentUsername) {
      message.error(`¡Espera ${diasRestantes} días más para cambiar tu nombre!`);
    } else {
      localStorage.setItem("username", tempUsername);
      localStorage.setItem("lastChangeDate", new Date().toISOString());
      setCurrentUsername(tempUsername);
      message.success("Nombre actualizado");
      setView("HUB");
    }
  };

  const renderHub = () => (
    <div className="menu-hub-container">
      <div className="menu-header-minimal">
        <div className="avatar-mini-img">
          <img src={logo} alt="Logo" className="logo-img" />
        </div>
        <div className="user-info-mini">
          <h3>@{currentUsername}</h3>
          <span className="badge-rango" style={{ color: level.color }}>
            {level.rango} (Niv. {level.nivel})
          </span>
        </div>
      </div>

      <div className="xp-section">
        <div className="xp-labels">
          <span>{formatXP(userXP)} XP</span>
          <span>Siguiente Nivel: {level.next} reportes</span>
        </div>
        <Progress
          percent={percent}
          showInfo={false}
          strokeColor={level.color}
          trailColor="#f1f2f6"
          strokeWidth={10}
        />
      </div>

      <div className="menu-list">
        <div className="menu-item" onClick={() => setView("PROFILE")}>
          <div className="item-left">
            <UserOutlined /> <span>Mi Perfil</span>
          </div>
          <RightOutlined className="arrow-icon" />
        </div>
        <div className="menu-item" onClick={() => setView("HISTORY")}>
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
      <div className="menu-item logout-item-inline" onClick={handleLogout}>
        <div className="item-left">
          <LogoutOutlined /> <span>Cerrar Sesión</span>
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
          disabled={isButtonDisabled}
        >
          Guardar
        </Button>
      </div>
    </div>
  );

  const renderHistory = () => {
    const historialReal = JSON.parse(
      localStorage.getItem("historial_reportes") || "[]",
    );
    return (
      <div className="menu-subview-container">
        <h2 className="subview-title centered">Mis Reportes</h2>
        <div className="history-table">
          <div className="h-row h-head">
            <span>Coords</span>
            <span>Clima</span>
            <span>Fecha</span>
          </div>
          <div className="h-scroll">
            {historialReal.length === 0 && (
              <p style={{ textAlign: "center", color: "#8c8c8c", margin: "16px 0" }}>
                Aún no tienes reportes.
              </p>
            )}
            {historialReal.map((item) => (
              <div className="h-row" key={item.id}>
                <span className="truncate-text">{item.ubicacion}</span>
                <span>{item.tipo}</span>
                <span>{item.fecha}</span>
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
  };

  const renderSupport = () => (
    <div className="menu-subview-container">
      <h2 className="subview-title centered">Soporte</h2>
      <Select
        placeholder="Asunto"
        className="minimal-select"
        style={{ width: "100%" }}
      >
        <Select.Option value="error">Error</Select.Option>
        <Select.Option value="sugerencia">Sugerencia</Select.Option>
      </Select>
      <Input.TextArea
        rows={4}
        placeholder="Dinos qué sucede..."
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
          onClick={() => message.success("Enviado")}
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
