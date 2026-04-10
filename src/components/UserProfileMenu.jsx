import React, { useState, useEffect } from "react";
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
import logo from "./assets/icono.png";
import "./UserProfileMenu.css";

const UserProfileMenu = ({ onCancel, userFromLogin = "Invitado" }) => {
  const [view, setView] = useState("HUB");
  const [currentUsername, setCurrentUsername] = useState(userFromLogin);
  const [tempUsername, setTempUsername] = useState(userFromLogin);

  // Estados para XP y Nivel
  const [userXP, setUserXP] = useState(0);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    setCurrentUsername(userFromLogin);
    setTempUsername(userFromLogin);
    // Cargar progreso del usuario
    setUserXP(parseInt(localStorage.getItem("user_xp") || "0"));
    setReportCount(parseInt(localStorage.getItem("user_reports_count") || "0"));
  }, [userFromLogin]);

  // Lógica de Formateo XP (estilo Instagram 1k, 10k)
  const formatXP = (xp) => {
    if (xp >= 1000) {
      return (xp / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
    return xp.toString();
  };

  // Lógica de Niveles
  const getLevelInfo = (count) => {
    if (count <= 100)
      return { nivel: 1, rango: "Observador", next: 100, color: "#ff4e4e" };
    if (count <= 1000)
      return { nivel: 2, rango: "Informante", next: 1000, color: "#74acff" };
    if (count <= 3000)
      return { nivel: 3, rango: "Explorador", next: 3000, color: "#2c3e50" };
    return { nivel: 3, rango: "Explorador", next: 3000, color: "#2c3e50" };
  };

  const level = getLevelInfo(reportCount);
  const percent = Math.min((reportCount / level.next) * 100, 100);

  const [lastChangeDate] = useState(() => {
    const savedDate = localStorage.getItem("lastChangeDate");
    return savedDate ? new Date(savedDate) : new Date();
  });

  const usernameRegex = /^[a-zA-Z0-9._-]*$/;
  const isUsernameValid =
    tempUsername.length >= 3 &&
    tempUsername.length <= 20 &&
    /^[a-zA-Z0-9._-]+$/.test(tempUsername);

  const now = new Date();
  const diffDays = Math.floor(
    Math.abs(now - lastChangeDate) / (1000 * 60 * 60 * 24),
  );
  const isButtonDisabled =
    !isUsernameValid || tempUsername === currentUsername || diffDays < 7;

  const handleSave = () => {
    if (diffDays < 7 && tempUsername !== currentUsername) {
      message.error(`¡Espera ${7 - diffDays} días más para cambiar tu nombre!`);
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
          className="minimal-input"
          onChange={(e) =>
            setTempUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
          }
          status={!isUsernameValid && tempUsername.length > 0 ? "error" : ""}
        />
        <p className="hint">
          Solo letras, números, ( . _ - ). Espera de 7 días.
        </p>
      </div>
      <Divider />
      <div
        className="menu-item logout-item-inline"
        onClick={() => message.warning("Sesión cerrada")}
      >
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
