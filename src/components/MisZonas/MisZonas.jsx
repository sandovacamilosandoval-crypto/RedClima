import React, { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Popconfirm, Spin } from "antd";
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { LocateFixed } from "lucide";
import { supabase } from "../../lib/supabase";
import { mensajeError } from "../../lib/errores";
import { haceCuanto } from "../../lib/formato";
import { CLIMA_POR_ID } from "../../constants/clima";
import { useAuth } from "../../context/AuthContext";
import Buscador from "../Buscador/Buscador";
import Icono from "../Icono";
import "./MisZonas.css";

// Zonas de interés: el clima de tu trabajo, tu casa… y aviso cuando alguien reporta ahí
export default function MisZonas({ ubicacion, onVolver, onIrA }) {
  const { message } = App.useApp();
  const { refrescarNotificaciones } = useAuth();
  const [zonas, setZonas] = useState(null);
  const [agregando, setAgregando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [lugar, setLugar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [ahora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("mis_zonas_interes");
    if (error) {
      message.error(mensajeError(error, "No pudimos cargar tus zonas"));
      setZonas([]);
      return;
    }
    setZonas(data ?? []);
  }, [message]);

  useEffect(() => {
    let activo = true;
    Promise.resolve().then(() => activo && cargar());
    // Al ver tus zonas, los avisos de zonas quedan leídos
    supabase.rpc("marcar_notificaciones_leidas", { p_ticket: null }).then(() => refrescarNotificaciones());
    return () => {
      activo = false;
    };
  }, [cargar, refrescarNotificaciones]);

  const guardar = async () => {
    if (guardando) return;
    if (!lugar) {
      message.warning("Elige el lugar con el buscador o usa tu ubicación actual");
      return;
    }
    if (!nombre.trim()) {
      message.warning("Ponle un nombre, por ejemplo: Trabajo");
      return;
    }
    setGuardando(true);
    const { error } = await supabase.rpc("guardar_zona_interes", {
      p_nombre: nombre.trim(),
      p_lat: lugar.lat,
      p_lng: lugar.lng,
    });
    setGuardando(false);
    if (error) {
      message.error(mensajeError(error, "No pudimos guardar la zona"));
      return;
    }
    message.success(`Listo. Te avisaremos cuando alguien reporte el clima en ${nombre.trim()}.`);
    setAgregando(false);
    setNombre("");
    setLugar(null);
    cargar();
  };

  const borrar = async (z) => {
    const { error } = await supabase.rpc("eliminar_zona_interes", { p_id: z.id });
    if (error) {
      message.error(mensajeError(error, "No pudimos borrar la zona"));
      return;
    }
    cargar();
  };

  if (agregando) {
    return (
      <div className="menu-subview-container">
        <h2 className="subview-title centered">Nueva zona de interés</h2>
        <label className="input-label" htmlFor="zona-nombre">Nombre</label>
        <Input
          id="zona-nombre"
          maxLength={30}
          placeholder="Ej.: Trabajo, Universidad, Casa de mamá"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={{ borderRadius: 12, marginBottom: 12 }}
        />
        <span className="input-label">Lugar</span>
        <Buscador
          compacto
          cerca={ubicacion}
          onElegir={(l) => {
            setLugar(l);
            if (!nombre.trim()) setNombre(l.nombre.slice(0, 30));
          }}
        />
        {ubicacion && (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, marginTop: 6 }}
            onClick={() => setLugar({ nombre: "Mi ubicación actual", lat: ubicacion.lat, lng: ubicacion.lng })}
          >
            <Icono nodo={LocateFixed} tamano={14} color="#1d63d6" /> Usar mi ubicación actual
          </Button>
        )}
        {lugar && <p className="zona-elegida">📍 {lugar.nombre}</p>}
        <p className="zonas-nota">Guardamos la zona redondeada a unos 100 m. Puedes tener hasta 5.</p>
        <div className="dual-buttons-container">
          <Button icon={<ArrowLeftOutlined />} className="btn-volver-rojo" onClick={() => setAgregando(false)}>
            Volver
          </Button>
          <Button type="primary" className="btn-action-azul" loading={guardando} onClick={guardar}>
            Guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-subview-container">
      <h2 className="subview-title centered">Mis zonas</h2>
      <p className="zonas-nota">
        Te avisamos cuando alguien reporta el clima en tus zonas, así no tienes que ir hasta allá para saberlo.
      </p>

      {zonas === null && (
        <div style={{ textAlign: "center", margin: "16px 0" }}>
          <Spin />
        </div>
      )}
      {zonas?.length === 0 && <p className="soporte-vacio">Aún no tienes zonas. Añade tu trabajo o tu universidad.</p>}

      <div className="zonas-lista">
        {zonas?.map((z) => {
          const c = z.tipo ? CLIMA_POR_ID[z.tipo] : null;
          return (
            <div key={z.id} className="zona-item">
              <button type="button" className="zona-item-principal" onClick={() => onIrA?.(z)}>
                <span className="zona-item-icono" style={{ "--clima": c?.color ?? "#cbd5e1" }}>
                  {c ? <Icono nodo={c.icono} tamano={20} color={c.color} /> : "—"}
                </span>
                <span className="zona-item-texto">
                  <strong>{z.nombre}</strong>
                  <small>
                    {c
                      ? `${c.label} · ${haceCuanto(z.actualizado_en, ahora).toLowerCase()} · ${z.personas} ${z.personas === 1 ? "persona" : "personas"}`
                      : "Sin reportes en la última hora"}
                  </small>
                </span>
              </button>
              <Popconfirm title={`¿Borrar ${z.nombre}?`} okText="Borrar" cancelText="No" onConfirm={() => borrar(z)}>
                <Button type="text" icon={<DeleteOutlined />} aria-label={`Borrar ${z.nombre}`} />
              </Popconfirm>
            </div>
          );
        })}
      </div>

      <div className="dual-buttons-container">
        <Button icon={<ArrowLeftOutlined />} className="btn-volver-rojo" onClick={onVolver}>
          Volver
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          className="btn-action-azul"
          disabled={(zonas?.length ?? 0) >= 5}
          onClick={() => setAgregando(true)}
        >
          Añadir
        </Button>
      </div>
    </div>
  );
}
