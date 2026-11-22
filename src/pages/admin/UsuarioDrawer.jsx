import React, { useState } from "react";
import { App, Alert, Button, Descriptions, Drawer, Input, InputNumber, Modal, Segmented, Space, Spin, Table, Tabs, Tag } from "antd";
import { supabase } from "../../lib/supabase";
import { mensajeError } from "../../lib/errores";
import { formatearFecha } from "../../lib/formato";
import { useAuth } from "../../context/AuthContext";
import { infoNivel } from "../../constants/niveles";
import { CATEGORIA_POR_ID } from "../../components/Soporte/categorias";
import TablaReportes from "./TablaReportes";
import { ESTADOS_CUENTA, ESTADOS_TICKET, PERIODOS, useRpc } from "./comun";

const ACCIONES = {
  advertir: { titulo: "Advertir", texto: "El usuario recibe un aviso con el motivo.", peligro: false },
  suspender: { titulo: "Suspender", texto: "No podrá reportar y sus reportes vigentes se ocultan.", peligro: true, dias: true },
  reactivar: { titulo: "Reactivar", texto: "La cuenta vuelve a estar activa.", peligro: false, soloAdmin: true },
  verificar: { titulo: "Verificar reportero", texto: "Sus reportes pesarán ×1,5 en el mapa.", peligro: false, soloAdmin: true },
  quitar_verificacion: { titulo: "Quitar verificación", texto: "Sus reportes vuelven a pesar lo normal.", peligro: true, soloAdmin: true },
  ajustar_xp: { titulo: "Ajustar XP", texto: "Suma o resta XP (cambia su nivel).", peligro: false, soloAdmin: true, xp: true },
  ocultar_reportes: { titulo: "Ocultar reportes vigentes", texto: "Retira del mapa todo lo que tiene activo ahora.", peligro: true },
};

const PERIODOS_USUARIO = [...PERIODOS.slice(2), { label: "3 meses", value: 2160 }];

export default function UsuarioDrawer({ usuarioId, onClose }) {
  const { message } = App.useApp();
  const { rol, session } = useAuth();
  const esAdmin = rol === "admin";
  const { data, error, cargando, recargar } = useRpc(
    "admin_usuarios",
    { p_id: usuarioId, p_limite: 1 },
    !!usuarioId
  );
  const u = data?.[0];
  const [horas, setHoras] = useState(720);
  const [accion, setAccion] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState(3);
  const [xp, setXp] = useState(50);
  const [guardando, setGuardando] = useState(false);
  const historial = useRpc("admin_auditoria", { p_usuario: usuarioId, p_limite: 50 }, !!usuarioId);

  const ejecutar = async () => {
    setGuardando(true);
    const { error: e } = await supabase.rpc("admin_moderar_usuario", {
      p_usuario: usuarioId,
      p_accion: accion,
      p_motivo: motivo.trim(),
      p_dias: ACCIONES[accion].dias ? dias : null,
      p_xp: ACCIONES[accion].xp ? xp : null,
    });
    setGuardando(false);
    if (e) {
      message.error(mensajeError(e, "No pudimos aplicar la acción"));
      return;
    }
    message.success("Acción aplicada y registrada");
    setAccion(null);
    setMotivo("");
    recargar();
    historial.recargar();
  };

  const nivel = u ? infoNivel(u.xp) : null;
  const esYo = usuarioId === session?.user?.id;

  return (
    <Drawer
      open={!!usuarioId}
      onClose={onClose}
      size={Math.min(720, typeof window !== "undefined" ? window.innerWidth : 720)}
      title={u ? `@${u.username}` : "Usuario"}
      destroyOnHidden
    >
      {error && <Alert type="error" showIcon title={mensajeError(error, "No pudimos cargar el usuario")} />}
      <Spin spinning={cargando}>
        {u && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={ESTADOS_CUENTA[u.estado]?.color}>{ESTADOS_CUENTA[u.estado]?.texto}</Tag>
              {u.verificado && <Tag color="blue">✔ Verificado</Tag>}
              {u.rol && <Tag color="purple">Equipo: {u.rol}</Tag>}
              <Tag color={nivel.actual.color}>Nivel {nivel.actual.nivel} · {nivel.actual.nombre}</Tag>
            </Space>

            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              bordered
              items={[
                { key: "reg", label: "Registro", children: formatearFecha(u.creado_en) },
                { key: "acc", label: "Último acceso", children: u.ultimo_acceso ? formatearFecha(u.ultimo_acceso) : "—" },
                { key: "xp", label: "XP", children: u.xp },
                { key: "tot", label: "Reportes totales", children: u.total_reportes },
                { key: "r7", label: "Reportes 7 días", children: u.reportes_7d },
                { key: "ult", label: "Último reporte", children: u.ultimo_reporte_en ? formatearFecha(u.ultimo_reporte_en) : "—" },
                { key: "tk", label: "Casos abiertos", children: u.tickets_abiertos },
                ...(u.estado === "suspendido"
                  ? [{ key: "sus", label: "Suspendido hasta", children: u.suspendido_hasta ? formatearFecha(u.suspendido_hasta) : "Indefinido" }]
                  : []),
                ...(esAdmin
                  ? [
                      { key: "em", label: "Correo", children: u.email ?? "—" },
                      {
                        key: "zona",
                        label: "Zona habitual (~1 km)",
                        children:
                          u.zona_lat != null ? (
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${u.zona_lat}&mlon=${u.zona_lng}#map=14/${u.zona_lat}/${u.zona_lng}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {u.zona_lat}, {u.zona_lng}
                            </a>
                          ) : (
                            "—"
                          ),
                      },
                    ]
                  : []),
              ]}
            />

            {!esYo && (
              <div className="acciones-moderacion">
                {Object.entries(ACCIONES)
                  .filter(([, a]) => esAdmin || !a.soloAdmin)
                  .filter(([k]) => !(k === "verificar" && u.verificado) && !(k === "quitar_verificacion" && !u.verificado))
                  .filter(([k]) => !(k === "reactivar" && u.estado === "activo"))
                  .map(([k, a]) => (
                    <Button key={k} size="small" danger={a.peligro} onClick={() => setAccion(k)}>
                      {a.titulo}
                    </Button>
                  ))}
              </div>
            )}

            <Tabs
              style={{ marginTop: 12 }}
              items={[
                {
                  key: "reportes",
                  label: "Reportes",
                  children: (
                    <>
                      <Segmented
                        size="small"
                        options={PERIODOS_USUARIO}
                        value={horas}
                        onChange={setHoras}
                        style={{ marginBottom: 8 }}
                      />
                      <TablaReportes horas={horas} usuarioId={usuarioId} onCambio={recargar} />
                    </>
                  ),
                },
                {
                  key: "casos",
                  label: `Casos (${u.tickets_abiertos} abiertos)`,
                  children: <CasosUsuario usuarioId={usuarioId} />,
                },
                {
                  key: "historial",
                  label: "Moderación",
                  children: (
                    <Table
                      rowKey="id"
                      size="small"
                      loading={historial.cargando}
                      dataSource={historial.data ?? []}
                      pagination={false}
                      scroll={{ x: 520 }}
                      locale={{ emptyText: "Sin acciones de moderación" }}
                      columns={[
                        { title: "Fecha", dataIndex: "creado_en", render: formatearFecha, width: 140 },
                        { title: "Acción", dataIndex: "accion" },
                        { title: "Por", dataIndex: "staff_username", render: (v) => (v ? `@${v}` : "—") },
                        { title: "Motivo", dataIndex: "motivo" },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </>
        )}
      </Spin>

      <Modal
        open={!!accion}
        title={accion ? `${ACCIONES[accion].titulo}: @${u?.username}` : ""}
        okText="Aplicar"
        okButtonProps={{ danger: accion && ACCIONES[accion].peligro, disabled: motivo.trim().length < 5 }}
        confirmLoading={guardando}
        onOk={ejecutar}
        onCancel={() => setAccion(null)}
        centered
      >
        {accion && (
          <Space orientation="vertical" style={{ width: "100%" }}>
            <p style={{ margin: 0 }}>{ACCIONES[accion].texto}</p>
            {ACCIONES[accion].dias && (
              <Space>
                <span>Días:</span>
                <InputNumber min={1} max={esAdmin ? 365 : 7} value={dias} onChange={(v) => setDias(v ?? 1)} />
                {!esAdmin && <span className="admin-ayuda">Moderadores: máximo 7 días</span>}
              </Space>
            )}
            {ACCIONES[accion].xp && (
              <Space>
                <span>XP (+/-):</span>
                <InputNumber value={xp} onChange={(v) => setXp(v ?? 0)} />
              </Space>
            )}
            <Input.TextArea
              rows={3}
              maxLength={300}
              placeholder="Motivo (obligatorio, queda en la auditoría)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-label="Motivo"
            />
          </Space>
        )}
      </Modal>
    </Drawer>
  );
}

function CasosUsuario({ usuarioId }) {
  const [estado, setEstado] = useState({ id: null, data: null });
  React.useEffect(() => {
    let vigente = true;
    supabase
      .from("tickets")
      .select("id, categoria, estado, prioridad, creado_en")
      .eq("usuario_id", usuarioId)
      .order("creado_en", { ascending: false })
      .limit(50)
      .then(({ data }) => vigente && setEstado({ id: usuarioId, data: data ?? [] }));
    return () => {
      vigente = false;
    };
  }, [usuarioId]);
  return (
    <Table
      rowKey="id"
      size="small"
      loading={estado.id !== usuarioId}
      dataSource={estado.data ?? []}
      pagination={false}
      locale={{ emptyText: "No ha escrito a soporte" }}
      columns={[
        { title: "#", dataIndex: "id", width: 60 },
        { title: "Motivo", dataIndex: "categoria", render: (c) => CATEGORIA_POR_ID[c]?.label ?? c },
        { title: "Estado", dataIndex: "estado", render: (e) => <Tag color={ESTADOS_TICKET[e]?.color}>{ESTADOS_TICKET[e]?.texto}</Tag> },
        { title: "Fecha", dataIndex: "creado_en", render: formatearFecha },
      ]}
    />
  );
}
