import React, { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Spin, Tag } from "antd";
import { ArrowLeftOutlined, PlusOutlined } from "@ant-design/icons";
import { supabase } from "../../lib/supabase";
import { mensajeError } from "../../lib/errores";
import { formatearFecha } from "../../lib/formato";
import { useAuth } from "../../context/AuthContext";
import { CATEGORIA_POR_ID, ESTADOS_USUARIO } from "./categorias";
import "./Soporte.css";

// Casos de soporte del usuario y avisos del equipo
export default function MisMensajes({ onVolver, onNuevo }) {
  const { message } = App.useApp();
  const { refrescarNotificaciones } = useAuth();
  const [tickets, setTickets] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [sinLeer, setSinLeer] = useState(new Set());
  const [abierto, setAbierto] = useState(null); // ticket seleccionado

  const cargar = useCallback(async () => {
    const [t, n] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, categoria, estado, creado_en, actualizado_en")
        .order("actualizado_en", { ascending: false })
        .limit(30),
      supabase
        .from("notificaciones")
        .select("id, tipo, titulo, cuerpo, ticket_id, leida, creado_en")
        .order("creado_en", { ascending: false })
        .limit(30),
    ]);
    if (t.error) {
      message.error(mensajeError(t.error, "No pudimos cargar tus mensajes"));
      setTickets([]);
      return;
    }
    setTickets(t.data);
    const notifs = n.data ?? [];
    setSinLeer(new Set(notifs.filter((x) => !x.leida && x.ticket_id).map((x) => x.ticket_id)));
    setAvisos(notifs.filter((x) => !x.ticket_id).slice(0, 5));
    // Los avisos sin caso se dan por leídos al verlos aquí;
    // las respuestas de cada caso se marcan al abrirlo
    if (notifs.some((x) => !x.leida && !x.ticket_id)) {
      await supabase.rpc("marcar_notificaciones_leidas", { p_ticket: null });
    }
    refrescarNotificaciones();
  }, [message, refrescarNotificaciones]);

  useEffect(() => {
    let activo = true;
    Promise.resolve().then(() => activo && cargar());
    return () => {
      activo = false;
    };
  }, [cargar]);

  if (abierto) {
    return (
      <Conversacion
        ticket={abierto}
        onVolver={() => {
          setAbierto(null);
          cargar();
        }}
      />
    );
  }

  return (
    <div className="menu-subview-container">
      <h2 className="subview-title centered">Mis mensajes</h2>

      {avisos.length > 0 && (
        <div className="avisos">
          {avisos.map((a) => (
            <div key={a.id} className="aviso">
              <strong>{a.titulo}</strong>
              {a.cuerpo && <p>{a.cuerpo}</p>}
              <span>{formatearFecha(a.creado_en)}</span>
            </div>
          ))}
        </div>
      )}

      {tickets === null && (
        <div style={{ textAlign: "center", margin: "16px 0" }}>
          <Spin />
        </div>
      )}
      {tickets?.length === 0 && (
        <p className="soporte-vacio">
          Aún no nos has escrito. Si algo no funciona o tienes una idea, ¡cuéntanos!
        </p>
      )}

      <div className="tickets-lista">
        {tickets?.map((t) => {
          const c = CATEGORIA_POR_ID[t.categoria];
          const e = ESTADOS_USUARIO[t.estado];
          return (
            <button key={t.id} type="button" className="ticket-item" onClick={() => setAbierto(t)}>
              <span className="ticket-item-titulo">
                {sinLeer.has(t.id) && <span className="ticket-nuevo" aria-label="Respuesta nueva" />}
                <span aria-hidden="true">{c?.emoji}</span> {c?.label ?? t.categoria}
              </span>
              <span className="ticket-item-meta">
                <Tag color={e?.color}>{e?.texto ?? t.estado}</Tag>
                <span>{formatearFecha(t.actualizado_en)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="dual-buttons-container">
        <Button icon={<ArrowLeftOutlined />} className="btn-volver-rojo" onClick={onVolver}>
          Volver
        </Button>
        <Button type="primary" icon={<PlusOutlined />} className="btn-action-azul" onClick={onNuevo}>
          Escribirnos
        </Button>
      </div>
    </div>
  );
}

function Conversacion({ ticket, onVolver }) {
  const { message } = App.useApp();
  const { refrescarNotificaciones } = useAuth();
  const [mensajes, setMensajes] = useState(null);
  const [estado, setEstado] = useState(ticket.estado);
  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    const [m, t] = await Promise.all([
      supabase
        .from("ticket_mensajes")
        .select("id, es_staff, cuerpo, creado_en")
        .eq("ticket_id", ticket.id)
        .order("creado_en", { ascending: true }),
      supabase.from("tickets").select("estado").eq("id", ticket.id).maybeSingle(),
    ]);
    if (m.error) {
      message.error(mensajeError(m.error, "No pudimos cargar la conversación"));
      setMensajes([]);
      return;
    }
    setMensajes(m.data);
    if (t.data) setEstado(t.data.estado);
    await supabase.rpc("marcar_notificaciones_leidas", { p_ticket: ticket.id });
    refrescarNotificaciones();
  }, [ticket.id, message, refrescarNotificaciones]);

  useEffect(() => {
    let activo = true;
    Promise.resolve().then(() => activo && cargar());
    return () => {
      activo = false;
    };
  }, [cargar]);

  const responder = async () => {
    if (enviando || !respuesta.trim()) return;
    setEnviando(true);
    const { error } = await supabase.rpc("responder_ticket", {
      p_ticket: ticket.id,
      p_cuerpo: respuesta.trim(),
      p_interno: false,
    });
    setEnviando(false);
    if (error) {
      message.error(mensajeError(error, "No pudimos enviar tu respuesta"));
      return;
    }
    setRespuesta("");
    cargar();
  };

  const c = CATEGORIA_POR_ID[ticket.categoria];
  const e = ESTADOS_USUARIO[estado];

  return (
    <div className="menu-subview-container">
      <h2 className="subview-title centered">
        <span aria-hidden="true">{c?.emoji}</span> {c?.label}
      </h2>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <Tag color={e?.color}>{e?.texto}</Tag>
      </div>

      <div className="conversacion" aria-live="polite">
        {mensajes === null && <Spin />}
        {mensajes?.map((m) => (
          <div key={m.id} className={`burbuja ${m.es_staff ? "equipo" : "yo"}`}>
            <span className="burbuja-autor">{m.es_staff ? "Equipo RedClima" : "Tú"}</span>
            <p>{m.cuerpo}</p>
            <span className="burbuja-fecha">{formatearFecha(m.creado_en)}</span>
          </div>
        ))}
      </div>

      {estado === "cerrado" ? (
        <p className="soporte-nota">Este caso está cerrado. Si necesitas algo más, escríbenos uno nuevo.</p>
      ) : (
        <>
          <Input.TextArea
            aria-label="Tu respuesta"
            rows={2}
            maxLength={2000}
            placeholder="Escribe tu respuesta…"
            value={respuesta}
            onChange={(ev) => setRespuesta(ev.target.value)}
            style={{ borderRadius: 12 }}
          />
          <Button
            type="primary"
            block
            loading={enviando}
            disabled={!respuesta.trim()}
            onClick={responder}
            style={{ marginTop: 8, borderRadius: 12 }}
          >
            Enviar respuesta
          </Button>
        </>
      )}

      <div className="menu-footer-centered">
        <Button icon={<ArrowLeftOutlined />} className="btn-volver-rojo" onClick={onVolver}>
          Volver
        </Button>
      </div>
    </div>
  );
}
