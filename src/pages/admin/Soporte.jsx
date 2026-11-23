import React, { useCallback, useEffect, useState } from "react";
import { App, Alert, Button, Card, Checkbox, Descriptions, Drawer, Input, Select, Space, Spin, Table, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { mensajeError } from "../../lib/errores";
import { formatearFecha } from "../../lib/formato";
import { CATEGORIAS, CATEGORIA_POR_ID } from "../../components/Soporte/categorias";
import { ESTADOS_TICKET, PRIORIDADES, useAdmin, useRpc } from "./comun";

const ABIERTOS = ["pendiente", "en_revision", "esperando_usuario"];

export default function Soporte() {
  const { message } = App.useApp();
  const [estados, setEstados] = useState(ABIERTOS);
  const [categoria, setCategoria] = useState(null);
  const [prioridad, setPrioridad] = useState(null);
  const [soloSinRespuesta, setSoloSinRespuesta] = useState(false);
  const [filas, setFilas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(null);
  const [version, setVersion] = useState(0);
  const [ahora] = useState(() => Date.now());

  useEffect(() => {
    let vigente = true;
    let q = supabase
      .from("tickets")
      .select("id, categoria, estado, prioridad, creado_en, actualizado_en, primera_respuesta_en, asignado_a, contexto, usuario_id, usuario:perfiles!tickets_usuario_id_fkey(username)")
      .order("prioridad", { ascending: false })
      .order("creado_en", { ascending: true })
      .limit(300);
    if (estados.length) q = q.in("estado", estados);
    if (categoria) q = q.eq("categoria", categoria);
    if (prioridad) q = q.eq("prioridad", prioridad);
    if (soloSinRespuesta) q = q.is("primera_respuesta_en", null);
    Promise.resolve().then(() => vigente && setCargando(true));
    q.then(({ data, error }) => {
      if (!vigente) return;
      setCargando(false);
      if (error) {
        message.error(mensajeError(error, "No pudimos cargar los casos"));
        setFilas([]);
      } else setFilas(data);
    });
    return () => {
      vigente = false;
    };
  }, [estados, categoria, prioridad, soloSinRespuesta, version, message]);

  const columnas = [
    { title: "#", dataIndex: "id", width: 60 },
    {
      title: "Prioridad",
      dataIndex: "prioridad",
      width: 95,
      render: (p) => <Tag color={PRIORIDADES[p]?.color}>{PRIORIDADES[p]?.texto}</Tag>,
    },
    {
      title: "Motivo",
      dataIndex: "categoria",
      render: (c) => (
        <span>
          {CATEGORIA_POR_ID[c]?.emoji} {CATEGORIA_POR_ID[c]?.label ?? c}
        </span>
      ),
    },
    { title: "Usuario", key: "u", render: (_, t) => `@${t.usuario?.username ?? "—"}` },
    {
      title: "Estado",
      dataIndex: "estado",
      width: 170,
      render: (e) => <Tag color={ESTADOS_TICKET[e]?.color}>{ESTADOS_TICKET[e]?.texto}</Tag>,
    },
    {
      title: "Recibido",
      dataIndex: "creado_en",
      width: 150,
      render: (v, t) => (
        <span>
          {formatearFecha(v)}
          {!t.primera_respuesta_en && ahora - new Date(v).getTime() > 24 * 3600 * 1000 && (
            <Tag color="red" style={{ marginLeft: 4 }}>+24 h</Tag>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="admin-pagina">
      <div className="admin-encabezado">
        <h1>Soporte</h1>
      </div>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            mode="multiple"
            allowClear
            style={{ minWidth: 240 }}
            placeholder="Estado"
            aria-label="Filtrar por estado"
            value={estados}
            onChange={setEstados}
            options={Object.entries(ESTADOS_TICKET).map(([value, e]) => ({ value, label: e.texto }))}
          />
          <Select
            allowClear
            style={{ minWidth: 200 }}
            placeholder="Motivo"
            aria-label="Filtrar por motivo"
            value={categoria}
            onChange={(v) => setCategoria(v ?? null)}
            options={CATEGORIAS.map((c) => ({ value: c.value, label: `${c.emoji} ${c.label}` }))}
          />
          <Select
            allowClear
            style={{ minWidth: 130 }}
            placeholder="Prioridad"
            aria-label="Filtrar por prioridad"
            value={prioridad}
            onChange={(v) => setPrioridad(v ?? null)}
            options={Object.entries(PRIORIDADES).map(([value, p]) => ({ value: Number(value), label: p.texto }))}
          />
          <Checkbox checked={soloSinRespuesta} onChange={(e) => setSoloSinRespuesta(e.target.checked)}>
            Sin respuesta
          </Checkbox>
        </Space>
        <Table
          rowKey="id"
          size="small"
          loading={cargando}
          columns={columnas}
          dataSource={filas ?? []}
          scroll={{ x: 760 }}
          pagination={{ pageSize: 25, hideOnSinglePage: true, showSizeChanger: false }}
          onRow={(t) => ({ onClick: () => setAbierto(t.id), style: { cursor: "pointer" } })}
          locale={{ emptyText: "No hay casos con estos filtros 🎉" }}
        />
      </Card>
      <TicketDrawer
        ticketId={abierto}
        onClose={() => setAbierto(null)}
        onCambio={() => setVersion((v) => v + 1)}
      />
    </div>
  );
}

function TicketDrawer({ ticketId, onClose, onCambio }) {
  const { message } = App.useApp();
  const { abrirUsuario } = useAdmin();
  const navigate = useNavigate();
  const equipo = useRpc("admin_equipo", {}, !!ticketId);
  const [datos, setDatos] = useState({ id: null, ticket: null, mensajes: [] });
  const [respuesta, setRespuesta] = useState("");
  const [interno, setInterno] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    if (!ticketId) return;
    const [t, m] = await Promise.all([
      supabase
        .from("tickets")
        .select("*, usuario:perfiles!tickets_usuario_id_fkey(username)")
        .eq("id", ticketId)
        .maybeSingle(),
      supabase
        .from("ticket_mensajes")
        .select("id, es_staff, interno, cuerpo, creado_en, autor:perfiles(username)")
        .eq("ticket_id", ticketId)
        .order("creado_en", { ascending: true }),
    ]);
    if (t.error || m.error) {
      message.error(mensajeError(t.error || m.error, "No pudimos cargar el caso"));
      return;
    }
    setDatos({ id: ticketId, ticket: t.data, mensajes: m.data });
  }, [ticketId, message]);

  useEffect(() => {
    let vigente = true;
    Promise.resolve().then(() => vigente && cargar());
    return () => {
      vigente = false;
    };
  }, [cargar]);

  const t = datos.id === ticketId ? datos.ticket : null;

  const actualizar = async (cambios) => {
    const { error } = await supabase.rpc("admin_actualizar_ticket", { p_ticket: ticketId, ...cambios });
    if (error) {
      message.error(mensajeError(error, "No pudimos actualizar el caso"));
      return;
    }
    message.success("Caso actualizado");
    cargar();
    onCambio();
  };

  const responder = async () => {
    if (!respuesta.trim() || enviando) return;
    setEnviando(true);
    const { error } = await supabase.rpc("responder_ticket", {
      p_ticket: ticketId,
      p_cuerpo: respuesta.trim(),
      p_interno: interno,
    });
    setEnviando(false);
    if (error) {
      message.error(mensajeError(error, "No pudimos enviar la respuesta"));
      return;
    }
    message.success(interno ? "Nota interna guardada" : "Respuesta enviada: el usuario recibirá un aviso");
    setRespuesta("");
    setInterno(false);
    cargar();
    onCambio();
  };

  const zona = t?.contexto?.zona;
  const { zona: _z, ...tecnico } = t?.contexto ?? {};

  return (
    <Drawer
      open={!!ticketId}
      onClose={onClose}
      size={Math.min(640, typeof window !== "undefined" ? window.innerWidth : 640)}
      title={t ? `Caso #${t.id} · ${CATEGORIA_POR_ID[t.categoria]?.label}` : "Caso"}
      destroyOnHidden
    >
      {!t ? (
        <Spin />
      ) : (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Select
              size="small"
              value={t.estado}
              aria-label="Estado"
              style={{ width: 190 }}
              onChange={(v) => actualizar({ p_estado: v })}
              options={Object.entries(ESTADOS_TICKET).map(([value, e]) => ({ value, label: e.texto }))}
            />
            <Select
              size="small"
              value={t.prioridad}
              aria-label="Prioridad"
              style={{ width: 110 }}
              onChange={(v) => actualizar({ p_prioridad: v })}
              options={Object.entries(PRIORIDADES).map(([value, p]) => ({ value: Number(value), label: p.texto }))}
            />
            <Select
              size="small"
              allowClear
              value={t.asignado_a}
              placeholder="Asignar a…"
              aria-label="Asignado a"
              style={{ width: 160 }}
              onChange={(v) => actualizar(v ? { p_asignado: v } : { p_quitar_asignado: true })}
              options={(equipo.data ?? []).map((m) => ({ value: m.usuario_id, label: `@${m.username}` }))}
            />
          </Space>

          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              {
                key: "u",
                label: "Usuario",
                children: (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => abrirUsuario(t.usuario_id)}>
                    @{t.usuario?.username}
                  </Button>
                ),
              },
              { key: "c", label: "Recibido", children: formatearFecha(t.creado_en) },
              {
                key: "r",
                label: "Primera respuesta",
                children: t.primera_respuesta_en ? formatearFecha(t.primera_respuesta_en) : "Aún sin respuesta",
              },
              ...(zona
                ? [
                    {
                      key: "z",
                      label: "Zona (~100 m)",
                      children: (
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0 }}
                          onClick={() => navigate(`/admin/reportes?lat=${zona.lat}&lng=${zona.lng}`)}
                        >
                          {zona.lat}, {zona.lng} · ver reportes de la zona
                        </Button>
                      ),
                    },
                  ]
                : []),
              {
                key: "t",
                label: "Datos técnicos",
                children: (
                  <code className="contexto">
                    {Object.entries(tecnico)
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                      .join("\n") || "—"}
                  </code>
                ),
              },
            ]}
          />

          <div className="admin-conversacion">
            {datos.mensajes.map((m) => (
              <div key={m.id} className={`admin-burbuja ${m.es_staff ? "equipo" : "usuario"} ${m.interno ? "interno" : ""}`}>
                <span className="admin-burbuja-autor">
                  {m.interno ? "🔒 Nota interna · " : ""}
                  {m.es_staff ? `Equipo (@${m.autor?.username ?? "—"})` : `@${m.autor?.username ?? "usuario"}`}
                </span>
                <p>{m.cuerpo}</p>
                <span className="admin-burbuja-fecha">{formatearFecha(m.creado_en)}</span>
              </div>
            ))}
          </div>

          {t.estado === "cerrado" && (
            <Alert type="info" showIcon title="Caso cerrado: el usuario no puede responder." style={{ marginBottom: 8 }} />
          )}
          <Input.TextArea
            rows={3}
            maxLength={4000}
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            placeholder={interno ? "Nota solo para el equipo…" : "Respuesta para el usuario…"}
            aria-label="Respuesta"
          />
          <Space style={{ marginTop: 8, width: "100%", justifyContent: "space-between" }} wrap>
            <Checkbox checked={interno} onChange={(e) => setInterno(e.target.checked)}>
              Nota interna (el usuario no la ve)
            </Checkbox>
            <Button type="primary" loading={enviando} disabled={!respuesta.trim()} onClick={responder}>
              {interno ? "Guardar nota" : "Responder"}
            </Button>
          </Space>
        </>
      )}
    </Drawer>
  );
}
