import React, { useCallback, useState } from "react";
import { App, Button, Progress, Spin } from "antd";
import {
  User,
  History,
  MapPin,
  Trophy,
  LifeBuoy,
  LayoutDashboard,
  LogOut,
  Trash2,
  ChevronRight,
  X,
} from "lucide";
import { useNavigate } from "react-router-dom";
import logo from "./assets/icono.png";
import { CLIMA_POR_ID, DIAS_BLOQUEO_USERNAME } from "../constants/clima";
import { NIVELES, XP_POR_REPORTE, infoNivel } from "../constants/niveles";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { formatearFecha } from "../lib/formato";
import { mensajeError } from "../lib/errores";
import Icono from "./Icono";
import Hoja from "./Hoja/Hoja";
import CampoUsuario from "./CampoUsuario";
import SoporteForm from "./Soporte/SoporteForm";
import MisMensajes from "./Soporte/MisMensajes";
import MisZonas from "./MisZonas/MisZonas";
import "./UserProfileMenu.css";

const formatXP = (xp) =>
  xp >= 1000 ? (xp / 1000).toFixed(1).replace(/\.0$/, "").replace(".", ",") + "k" : String(xp);

// Fila de la lista del menú
function Fila({ icono, texto, detalle, insignia, peligro, onClick }) {
  return (
    <button type="button" className={`lista-fila ${peligro ? "peligro" : ""}`} onClick={onClick}>
      <Icono nodo={icono} tamano={20} color={peligro ? "#c62828" : "#4a5568"} />
      <span className="lista-texto">
        {texto}
        {detalle && <small>{detalle}</small>}
      </span>
      {insignia > 0 && (
        <span className="insignia" aria-label={`${insignia} sin leer`}>
          {insignia}
        </span>
      )}
      {!peligro && (
        <span className="lista-flecha">
          <Icono nodo={ChevronRight} tamano={18} />
        </span>
      )}
    </button>
  );
}

const UserProfileMenu = ({ onCancel, ubicacion, onIrA }) => {
  const navigate = useNavigate();
  const { perfil, rol, noLeidasSoporte, noLeidasZonas, refrescarPerfil, cerrarSesion } = useAuth();
  const { message, modal } = App.useApp();

  const [view, setView] = useState("HUB");
  const [tempUsername, setTempUsername] = useState(perfil?.username ?? "");
  const [estadoUsuario, setEstadoUsuario] = useState({ valido: true, disponible: true });
  const alEstadoUsuario = useCallback((e) => setEstadoUsuario(e), []);
  const [guardando, setGuardando] = useState(false);
  // El menú se monta cada vez que se abre, así que esta hora siempre es actual
  const [ahora] = useState(() => Date.now());
  const [historial, setHistorial] = useState(null);

  if (!perfil) return null;

  const esEquipo = !!rol;
  const nivel = infoNivel(perfil.xp);

  const diffDays = Math.floor((ahora - new Date(perfil.username_cambiado_en).getTime()) / 86400000);
  const diasRestantes = DIAS_BLOQUEO_USERNAME - diffDays;
  const puedeGuardar =
    estadoUsuario.valido && estadoUsuario.disponible === true && tempUsername !== perfil.username && diasRestantes <= 0;

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
    if (guardando || !puedeGuardar) return;
    setGuardando(true);
    try {
      const { error } = await supabase.rpc("cambiar_username", { p_username: tempUsername });
      if (error) {
        message.error(mensajeError(error, "No pudimos cambiar tu nombre. Inténtalo de nuevo."));
        return;
      }
      message.success(`Ahora eres @${tempUsername}`);
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
      title: "¿Eliminar tu cuenta?",
      content: "Se borrarán tu perfil, tus reportes, tus zonas y tus mensajes. No se puede deshacer.",
      okText: "Eliminar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      centered: true,
      onOk: async () => {
        const { error } = await supabase.rpc("borrar_mi_cuenta");
        if (error) {
          message.error(mensajeError(error, "No pudimos eliminar tu cuenta. Escríbenos a soporte."));
          return;
        }
        message.success("Tu cuenta y tus datos fueron eliminados");
        await salir("local");
      },
    });
  };

  if (view === "PROFILE") {
    return (
      <Hoja
        titulo="Mi perfil"
        onAtras={() => setView("HUB")}
        pie={
          <Button type="primary" className="btn-principal" onClick={handleSave} loading={guardando} disabled={!puedeGuardar}>
            Guardar cambios
          </Button>
        }
      >
        <CampoUsuario
          id="perfil-username"
          valor={tempUsername}
          actual={perfil.username}
          onCambio={setTempUsername}
          onEstado={alEstadoUsuario}
          onEnter={handleSave}
        />
        <p className="t-xs">
          {diasRestantes > 0
            ? `Podrás cambiarlo en ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}.`
            : `Después de cambiarlo, tendrás que esperar ${DIAS_BLOQUEO_USERNAME} días para hacerlo de nuevo.`}
        </p>

        <p className="lista-seccion">Cuenta</p>
        <div className="lista">
          <Fila icono={LogOut} texto="Cerrar sesión" onClick={() => salir()} />
          <Fila icono={Trash2} texto="Eliminar mi cuenta y mis datos" peligro onClick={confirmarBorrarCuenta} />
        </div>
      </Hoja>
    );
  }

  if (view === "HISTORY") {
    return (
      <Hoja titulo="Mis reportes" subtitulo="Tus últimos 50 reportes" onAtras={() => setView("HUB")}>
        {historial === null && <Spin />}
        {historial?.length === 0 && <p className="vacio">Aún no tienes reportes.</p>}
        {historial?.length > 0 && (
          <div className="lista historial">
            {historial.map((item) => (
              <div className="lista-fila sin-accion" key={item.id}>
                <span className="lista-texto">
                  {CLIMA_POR_ID[item.tipo]?.label ?? item.tipo}
                  <small>
                    {formatearFecha(item.creado_en)} · {item.lat.toFixed(3)}, {item.lng.toFixed(3)}
                  </small>
                </span>
              </div>
            ))}
          </div>
        )}
      </Hoja>
    );
  }

  if (view === "NIVELES") {
    return (
      <Hoja
        titulo="Niveles"
        subtitulo={`Cada reporte suma ${XP_POR_REPORTE} XP. Cada nivel pide el doble que el anterior.`}
        onAtras={() => setView("HUB")}
      >
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
                  <span>{costo ? `${costo / XP_POR_REPORTE} reportes para subir` : "Nivel máximo"}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </Hoja>
    );
  }

  if (view === "ZONAS") {
    return <MisZonas ubicacion={ubicacion} onVolver={() => setView("HUB")} onIrA={onIrA} />;
  }

  if (view === "SOPORTE") {
    return <MisMensajes onVolver={() => setView("HUB")} onNuevo={() => setView("NUEVA_CONSULTA")} />;
  }

  if (view === "NUEVA_CONSULTA") {
    return <SoporteForm ubicacion={ubicacion} onVolver={() => setView("SOPORTE")} onEnviado={() => setView("SOPORTE")} />;
  }

  // Menú principal
  return (
    <div className="hoja">
      <div className="menu-cabecera">
        <img src={logo} alt="" className="menu-avatar" />
        <div className="menu-quien">
          <h2 className="t-h3">@{perfil.username}</h2>
          <p className="t-sm">
            Nivel {nivel.actual.nivel} · {nivel.actual.nombre}
            {perfil.verificado && " · Verificado"}
          </p>
        </div>
        <button type="button" className="hoja-icono" onClick={onCancel} aria-label="Cerrar menú">
          <Icono nodo={X} tamano={20} />
        </button>
      </div>

      <div className="menu-xp">
        <Progress
          percent={nivel.porcentaje}
          showInfo={false}
          strokeColor={nivel.actual.color}
          railColor="#eef1f5"
          size={{ height: 8 }}
          aria-label={`Progreso del nivel ${nivel.actual.nivel}`}
        />
        <p className="t-xs">
          {nivel.siguiente
            ? `${formatXP(nivel.xpEnNivel)} de ${formatXP(nivel.xpNecesaria)} XP · ${nivel.reportesFaltantes} ${nivel.reportesFaltantes === 1 ? "reporte" : "reportes"} para ${nivel.siguiente.nombre}`
            : `${formatXP(perfil.xp)} XP · ¡Nivel máximo!`}
        </p>
      </div>

      <div className="lista">
        <Fila icono={User} texto="Mi perfil" onClick={() => setView("PROFILE")} />
        <Fila icono={History} texto="Mis reportes" onClick={abrirHistorial} />
        <Fila icono={MapPin} texto="Mis zonas de interés" insignia={noLeidasZonas} onClick={() => setView("ZONAS")} />
        <Fila icono={Trophy} texto="Niveles" onClick={() => setView("NIVELES")} />
        {/* El soporte es para usuarios; el equipo responde desde el panel */}
        {!esEquipo && (
          <Fila
            icono={LifeBuoy}
            texto="Soporte"
            detalle="Dudas, errores, quejas o ideas"
            insignia={noLeidasSoporte}
            onClick={() => setView("SOPORTE")}
          />
        )}
        {esEquipo && <Fila icono={LayoutDashboard} texto="Panel de administración" onClick={() => navigate("/admin")} />}
      </div>
    </div>
  );
};

export default UserProfileMenu;
