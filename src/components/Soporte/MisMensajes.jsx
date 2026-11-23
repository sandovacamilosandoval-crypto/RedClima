import React, { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Spin, Tag } from "antd";
import { ChevronRight } from "lucide";
import { supabase } from "../../lib/supabase";
import { mensajeError } from "../../lib/errores";
import { formatearFecha } from "../../lib/formato";
import { useAuth } from "../../context/AuthContext";
import Hoja from "../Hoja/Hoja";
import Icono from "../Icono";
import { CATEGORIA_POR_ID, ESTADOS_USUARIO } from "./categorias";
import "./Soporte.css";

// Soporte: tus conversaciones con el administrador y sus avisos
export default function MisMensajes({ onVolver, onNuevo }) {
  const { message } = App.useApp();
  const { refrescarNotificaciones } = useAuth();
  const [tickets, setTickets] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [sinLeer, setSinLeer] = useState(new Set());
  const [abierto, setAbierto] = useState(null);

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
        .neq("tipo", "zona_interes")
        .order("creado_en", { ascending: false })
        .limit(30),
    ]);
    if (t.error) {
      message.error(mensajeError(t.error, "No pudimos cargar tus conversaciones"));
      setTickets([]);
      return;
    }
    setTickets(t.data);
    const notifs = n.data ?? [];
    setSinLeer(new Set(notifs.filter((x) => !x.leida && x.ticket_id).map((x) => x.ticket_id)));
    setAvisos(notifs.filter((x) => !x.ticket_id).slice(0, 5));
    // Los avisos del administrador se dan por leídos al verlos aquí;
    // las respuestas de cada conversación se marcan al abrirla
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
    <Hoja
      titulo="Soporte"
      subtitulo="Escríbele al administrador de RedClima. Te responde aquí."
      onAtras={onVolver}
      pie={
        <Button type="primary" className="btn-principal" onClick={onNuevo}>
          Nueva consulta
        </Button>
      }
    >
      {avisos.length > 0 && (
        <div className="avisos">
          {avisos.map((a) => (
            <div key={a.id} className="aviso">
              <span className="aviso-de">Administrador · {formatearFecha(a.creado_en)}</span>
              <strong>{a.titulo}</strong>
              {a.cuerpo && <p>{a.cuerpo}</p>}
            </div>
          ))}
        </div>
      )}

      {tickets === null && <Spin />}
      {tickets?.length === 0 && <p className="vacio">Aún no tienes conversaciones. Si algo falla o tienes una idea, escríbenos.</p>}

      {tickets?.length > 0 && (
        <div className="lista">
          {tickets.map((t) => {
            const c = CATEGORIA_POR_ID[t.categoria];
            const e = ESTADOS_USUARIO[t.estado];
            return (
              <button key={t.id} type="button" className="lista-fila" onClick={() => setAbierto(t)}>
                <span aria-hidden="true">{c?.emoji}</span>
                <span className="lista-texto">
                  {c?.label ?? t.categoria}
                  <small>
                    Con el administrador · {formatearFecha(t.actualizado_en)}
                  </small>
                </span>
                {sinLeer.has(t.id) ? (
                  <span className="insignia" aria-label="Respuesta nueva">1</span>
                ) : (
                  <Tag color={e?.color} style={{ marginInlineEnd: 0 }}>{e?.texto ?? t.estado}</Tag>
                )}
                <span className="lista-flecha">
                  <Icono nodo={ChevronRight} tamano={18} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Hoja>
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
  const cerrado = estado === "cerrado";

  return (
    <Hoja
      titulo={c?.label ?? "Conversación"}
      subtitulo={`Con el administrador · ${e?.texto ?? estado}`}
      onAtras={onVolver}
      pie={
        cerrado ? null : (
          <Button type="primary" className="btn-principal" loading={enviando} disabled={!respuesta.trim()} onClick={responder}>
            Enviar
          </Button>
        )
      }
    >
      <div className="conversacion" aria-live="polite">
        {mensajes === null && <Spin />}
        {mensajes?.map((m) => (
          <div key={m.id} className={`burbuja ${m.es_staff ? "equipo" : "yo"}`}>
            <span className="burbuja-autor">{m.es_staff ? "Administrador" : "Tú"}</span>
            <p>{m.cuerpo}</p>
            <span className="burbuja-fecha">{formatearFecha(m.creado_en)}</span>
          </div>
        ))}
      </div>

      {cerrado ? (
        <p className="t-xs">Esta conversación está cerrada. Si necesitas algo más, abre una nueva consulta.</p>
      ) : (
        <Input.TextArea
          aria-label="Tu respuesta"
          autoSize={{ minRows: 2, maxRows: 5 }}
          maxLength={2000}
          placeholder="Escribe tu respuesta…"
          value={respuesta}
          onChange={(ev) => setRespuesta(ev.target.value)}
        />
      )}
    </Hoja>
  );
}
