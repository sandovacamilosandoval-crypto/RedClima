import React, { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Popconfirm, Spin } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { LocateFixed } from "lucide";
import { supabase } from "../../lib/supabase";
import { mensajeError } from "../../lib/errores";
import { haceCuanto } from "../../lib/formato";
import { CLIMA_POR_ID } from "../../constants/clima";
import { useAuth } from "../../context/AuthContext";
import Buscador from "../Buscador/Buscador";
import Icono from "../Icono";
import Hoja from "../Hoja/Hoja";
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
      <Hoja
        titulo="Nueva zona"
        subtitulo="Te avisaremos cuando alguien reporte el clima ahí."
        onAtras={() => setAgregando(false)}
        pie={
          <Button type="primary" className="btn-principal" loading={guardando} onClick={guardar}>
            Guardar zona
          </Button>
        }
      >
        <div className="campo">
          <label className="campo-etiqueta" htmlFor="zona-nombre">Nombre</label>
          <Input
            id="zona-nombre"
            size="large"
            maxLength={30}
            placeholder="Ej.: Trabajo, Universidad"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="campo">
          <span className="campo-etiqueta">Lugar</span>
          <Buscador
            compacto
            cerca={ubicacion}
            onElegir={(l) => {
              setLugar(l);
              if (!nombre.trim()) setNombre(l.nombre.slice(0, 30));
            }}
          />
          {ubicacion && (
            <button
              type="button"
              className="enlace"
              onClick={() => setLugar({ nombre: "Mi ubicación actual", lat: ubicacion.lat, lng: ubicacion.lng })}
            >
              <Icono nodo={LocateFixed} tamano={14} /> Usar mi ubicación actual
            </button>
          )}
          <p className="campo-ayuda">{lugar ? `Elegido: ${lugar.nombre}` : "Busca un lugar o usa tu ubicación. Guardamos la zona redondeada a ~100 m."}</p>
        </div>
      </Hoja>
    );
  }

  return (
    <Hoja
      titulo="Mis zonas de interés"
      subtitulo="Mira su clima y recibe un aviso cuando alguien reporte ahí. Hasta 5."
      onAtras={onVolver}
      pie={
        <Button type="primary" className="btn-principal" disabled={(zonas?.length ?? 0) >= 5} onClick={() => setAgregando(true)}>
          Añadir zona
        </Button>
      }
    >
      {zonas === null && <Spin />}
      {zonas?.length === 0 && <p className="vacio">Aún no tienes zonas. Añade tu trabajo o tu universidad.</p>}

      {zonas?.length > 0 && (
        <div className="lista">
          {zonas.map((z) => {
            const c = z.tipo ? CLIMA_POR_ID[z.tipo] : null;
            return (
              <div key={z.id} className="zona-item">
                <button type="button" className="lista-fila" onClick={() => onIrA?.(z)}>
                  <span className="zona-item-icono" style={{ "--clima": c?.color ?? "#cbd5e1" }}>
                    {c ? <Icono nodo={c.icono} tamano={18} color={c.color} /> : null}
                  </span>
                  <span className="lista-texto">
                    {z.nombre}
                    <small>
                      {c
                        ? `${c.label} · ${haceCuanto(z.actualizado_en, ahora).toLowerCase()} · ${z.personas} ${z.personas === 1 ? "persona" : "personas"}`
                        : "Sin reportes en la última hora"}
                    </small>
                  </span>
                </button>
                <Popconfirm title={`¿Borrar ${z.nombre}?`} okText="Borrar" cancelText="No" onConfirm={() => borrar(z)}>
                  <Button type="text" icon={<DeleteOutlined />} aria-label={`Borrar ${z.nombre}`} className="zona-borrar" />
                </Popconfirm>
              </div>
            );
          })}
        </div>
      )}
    </Hoja>
  );
}
