import React, { useState } from "react";
import { App, Button, Input, Divider, Progress, Spin } from "antd";
import {
  UserOutlined,
  HistoryOutlined,
  CustomerServiceOutlined,
  LogoutOutlined,
  ArrowLeftOutlined,
  RightOutlined,
  DeleteOutlined,
  MessageOutlined,
  DashboardOutlined,
  TrophyOutlined,
  EnvironmentOutlined,
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
import { mensajeError } from "../lib/errores";
import { NIVELES, XP_POR_REPORTE, infoNivel } from "../constants/niveles";
import SoporteForm from "./Soporte/SoporteForm";
import MisMensajes from "./Soporte/MisMensajes";
import MisZonas from "./MisZonas/MisZonas";
import "./UserProfileMenu.css";

const formatXP = (xp) =>
  xp >= 1000 ? (xp / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(xp);

const UserProfileMenu = ({ onCancel, ubicacion, onIrA }) => {
  const navigate = useNavigate();
  const { perfil, rol, noLeidas, refrescarPerfil, cerrarSesion } = useAuth();
  const { message, modal } = App.useApp();

  const [view, setView] = useState("HUB");
  const [tempUsername, setTempUsername] = useState(perfil?.username ?? "");
  const [guardando, setGuardando] = useState(false);
  // El menú se monta cada vez que se abre, así que esta hora siempre es actual
  const [ahora] = useState(() => Date.now());

  const [historial, setHistorial] = useState(null);

  if (!perfil) return null;

  const nivel = infoNivel(perfil.xp);

  const isUsernameValid = esUsernameValido(tempUsername);
  const mostrarError = !isUsernameValid && tempUsername.length > 0;
  const diffDays = Math.floor((ahora - new Date(perfil.username_cambiado_en).getTime()) / 86400000);
  const diasRestantes = DIAS_BLOQUEO_USERNAME - diffDays;
  const isButtonDisabled =
    !isUsernameValid || tempUsername === perfil.username || diasRestantes > 0;

  // scope "local" tras borrar la cuenta: el usuario ya no existe en el servidor
  const salir = async (scope = "global") => {
    try {
      await cerrarSesion(scope);
    } catch {
      // aunque falle la red, salimos de la pantalla
    }
    onCancel?.();
    navigate("/", { replace: true });
  };

  const handleSave = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      const { error } = await supabase.rpc("cambiar_username", { p_username: tempUsername });
      if (error) {
        message.error(mensajeError(error, "No pudimos cambiar tu nombre. Inténtalo de nuevo."));
        return;
      }
      message.success("Nombre actualizado");
      setView("HUB");
      await refrescarPerfil().catch(() => {});
    } finally {
      setGuardando(false);
    }
  };

  const abrirHistorial = async () => {
    setView("HISTORY");
    setHistorial(null);
    const { data, error } = await supabase.rpc("mis_reportes", { p_limite: 50 });
    if (error) {
      message.error(mensajeError(error, "No pudimos cargar tu historial"));
      setHistorial([]);
    } else {
      setHistorial(data);
    }
  };

  const confirmarBorrarCuenta = () => {
    modal.confirm({
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
          message.error(mensajeError(error, "No pudimos borrar tu cuenta. Escríbenos a soporte."));
          return;
        }
        message.success("Tu cuenta y tus datos fueron eliminados");
        await salir("local");
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
          <span className="badge-rango" style={{ color: nivel.actual.color }}>
            Nivel {nivel.actual.nivel} · {nivel.actual.nombre}
            {perfil.verificado && " · ✔ Verificado"}
          </span>
        </div>
      </div>

      <div className="xp-section">
        <div className="xp-labels">
          {nivel.siguiente ? (
            <>
              <span>
                {formatXP(nivel.xpEnNivel)} / {formatXP(nivel.xpNecesaria)} XP
              </span>
              <span>
                {nivel.reportesFaltantes} {nivel.reportesFaltantes === 1 ? "reporte" : "reportes"} para{" "}
                {nivel.siguiente.nombre}
              </span>
            </>
          ) : (
            <>
              <span>{formatXP(perfil.xp)} XP</span>
              <span>¡Nivel máximo!</span>
            </>
          )}
        </div>
        <Progress
          percent={nivel.porcentaje}
          showInfo={false}
          strokeColor={nivel.actual.color}
          railColor="#f1f2f6"
          size={{ height: 10 }}
          aria-label={`Progreso del nivel ${nivel.actual.nivel}`}
        />
      </div>

      <div className="menu-list">
        <button type="button" className="menu-item" onClick={() => setView("PROFILE")}>
          <div className="item-left">
            <UserOutlined /> <span>Mi Perfil</span>
          </div>
          <RightOutlined className="arrow-icon" aria-hidden="true" />
        </button>
        <button type="button" className="menu-item" onClick={abrirHistorial}>
          <div className="item-left">
            <HistoryOutlined /> <span>Mis Reportes</span>
          </div>
          <RightOutlined className="arrow-icon" aria-hidden="true" />
        </button>
        <button type="button" className="menu-item" onClick={() => setView("ZONAS")}>
          <div className="item-left">
            <EnvironmentOutlined /> <span>Mis zonas de interés</span>
          </div>
          <RightOutlined className="arrow-icon" aria-hidden="true" />
        </button>
        <button type="button" className="menu-item" onClick={() => setView("NIVELES")}>
          <div className="item-left">
            <TrophyOutlined /> <span>Niveles</span>
          </div>
          <RightOutlined className="arrow-icon" aria-hidden="true" />
        </button>
        <button type="button" className="menu-item" onClick={() => setView("MENSAJES")}>
          <div className="item-left">
            <MessageOutlined /> <span>Mis mensajes</span>
          </div>
          {noLeidas > 0 && (
            <span className="badge-menu" aria-label={`${noLeidas} sin leer`}>
              {noLeidas}
            </span>
          )}
          <RightOutlined className="arrow-icon" aria-hidden="true" />
        </button>
        <button type="button" className="menu-item" onClick={() => setView("SUPPORT")}>
          <div className="item-left">
            <CustomerServiceOutlined /> <span>Ayuda, quejas o sugerencias</span>
          </div>
          <RightOutlined className="arrow-icon" aria-hidden="true" />
        </button>
        {rol && (
          <button type="button" className="menu-item" onClick={() => navigate("/admin")}>
            <div className="item-left">
              <DashboardOutlined /> <span>Panel de administración</span>
            </div>
            <RightOutlined className="arrow-icon" aria-hidden="true" />
          </button>
        )}
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
        <label className="input-label" htmlFor="perfil-username">Editar Nombre de Usuario</label>
        <Input
          id="perfil-username"
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
          style={{ color: mostrarError ? "#ff4d4f" : "#6b7280" }}
        >
          • Entre 3 y 20 caracteres: letras (a–z), números (0–9) y _ - .
        </span>
        <span className="setup-hint" style={{ color: "#6b7280" }}>
          {diasRestantes > 0
            ? `• Podrás cambiarlo en ${diasRestantes} día(s).`
            : `• Tras cambiarlo, no podrás hacerlo de nuevo en ${DIAS_BLOQUEO_USERNAME} días.`}
        </span>
      </div>
      <Divider />
      <button type="button" className="menu-item logout-item-inline" onClick={() => salir()}>
        <div className="item-left">
          <LogoutOutlined /> <span>Cerrar Sesión</span>
        </div>
      </button>
      <button type="button" className="menu-item logout-item-inline" onClick={confirmarBorrarCuenta}>
        <div className="item-left" style={{ color: "#cf1322" }}>
          <DeleteOutlined /> <span>Borrar mi cuenta y mis datos</span>
        </div>
      </button>
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
            <p style={{ textAlign: "center", color: "#6b7280", margin: "16px 0" }}>
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

  const renderNiveles = () => (
    <div className="menu-subview-container">
      <h2 className="subview-title centered">Niveles</h2>
      <p className="niveles-intro">
        Cada reporte suma {XP_POR_REPORTE} XP. Al subir de nivel, la barra vuelve a empezar y el
        siguiente nivel pide un poco más.
      </p>
      <ol className="niveles-lista">
        {NIVELES.map((n, i) => {
          const siguiente = NIVELES[i + 1];
          const costo = siguiente ? siguiente.desde - n.desde : null;
          const actual = n.nivel === nivel.actual.nivel;
          return (
            <li key={n.nivel} className={actual ? "actual" : ""} aria-current={actual ? "step" : undefined}>
              <span className="niveles-num" style={{ background: n.color }}>{n.nivel}</span>
              <div>
                <strong>{n.nombre}</strong>
                <span>
                  {costo
                    ? `${costo} XP (${costo / XP_POR_REPORTE} reportes) para subir`
                    : "Nivel máximo"}
                </span>
                <span className="niveles-premio">{n.premio}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="menu-footer-centered">
        <Button icon={<ArrowLeftOutlined />} className="btn-volver-rojo" onClick={() => setView("HUB")}>
          Volver
        </Button>
      </div>
    </div>
  );

  return (
    <div className="minimal-menu-wrapper">
      {view === "HUB" && renderHub()}
      {view === "PROFILE" && renderProfile()}
      {view === "HISTORY" && renderHistory()}
      {view === "NIVELES" && renderNiveles()}
      {view === "ZONAS" && <MisZonas ubicacion={ubicacion} onVolver={() => setView("HUB")} onIrA={onIrA} />}
      {view === "SUPPORT" && (
        <SoporteForm
          ubicacion={ubicacion}
          onVolver={() => setView("HUB")}
          onEnviado={() => setView("MENSAJES")}
        />
      )}
      {view === "MENSAJES" && (
        <MisMensajes onVolver={() => setView("HUB")} onNuevo={() => setView("SUPPORT")} />
      )}
    </div>
  );
};

export default UserProfileMenu;
