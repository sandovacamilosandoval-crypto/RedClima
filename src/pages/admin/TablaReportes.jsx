import React, { useState } from "react";
import { App, Button, Input, Modal, Table, Tag, Tooltip } from "antd";
import { EyeInvisibleOutlined, EyeOutlined } from "@ant-design/icons";
import { supabase } from "../../lib/supabase";
import { mensajeError } from "../../lib/errores";
import { formatearFecha, haceCuanto } from "../../lib/formato";
import { CLIMA_POR_ID } from "../../constants/clima";
import { useAdmin, useRpc } from "./comun";

// Tabla de reportes. Tocar una fila abre la ficha de quien reportó.
export default function TablaReportes({ horas, busqueda = "", soloOcultos = false, usuarioId = null, datos, onCambio }) {
  const { message } = App.useApp();
  const { abrirUsuario } = useAdmin();
  const propio = useRpc(
    "admin_reportes",
    { p_horas: horas, p_solo_ocultos: soloOcultos, p_usuario: usuarioId, p_limite: 500, p_busqueda: busqueda || null },
    !datos
  );
  const filas = datos ?? propio.data;
  const cargando = datos ? false : propio.cargando;
  const [moderando, setModerando] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ahora] = useState(() => Date.now());

  const cambiarVisibilidad = async (reporte, ocultar, texto) => {
    setGuardando(true);
    const { error } = await supabase.rpc("admin_ocultar_reporte", {
      p_reporte: reporte.id,
      p_ocultar: ocultar,
      p_motivo: texto ?? null,
    });
    setGuardando(false);
    if (error) {
      message.error(mensajeError(error, "No pudimos actualizar el reporte"));
      return;
    }
    message.success(ocultar ? "Reporte ocultado del mapa" : "Reporte visible de nuevo");
    setModerando(null);
    setMotivo("");
    propio.recargar();
    onCambio?.();
  };

  const columnas = [
    {
      title: "Cuándo",
      dataIndex: "creado_en",
      width: 130,
      render: (v) => (
        <Tooltip title={formatearFecha(v)}>
          <span>{haceCuanto(v, ahora)}</span>
        </Tooltip>
      ),
    },
    {
      title: "Clima",
      dataIndex: "tipo",
      width: 110,
      render: (t) => <Tag color={CLIMA_POR_ID[t]?.color}>{CLIMA_POR_ID[t]?.label ?? t}</Tag>,
    },
    {
      title: "Usuario",
      dataIndex: "username",
      render: (u, r) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            abrirUsuario(r.usuario_id);
          }}
        >
          @{u} {r.verificado && "✔"}
        </Button>
      ),
    },
    {
      title: "Zona (~100 m)",
      key: "zona",
      render: (_, r) => (
        <a
          href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=16/${r.lat}/${r.lng}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {r.lat.toFixed(3)}, {r.lng.toFixed(3)}
        </a>
      ),
    },
    { title: "Precisión", dataIndex: "precision_m", width: 95, render: (p) => (p == null ? "—" : `${Math.round(p)} m`) },
    {
      title: "Estado",
      key: "estado",
      width: 150,
      render: (_, r) =>
        r.oculto ? (
          <Tooltip title={r.oculto_motivo}>
            <Tag color="error">Oculto</Tag>
          </Tooltip>
        ) : new Date(r.expira_en).getTime() > ahora ? (
          <Tag color="success">En el mapa</Tag>
        ) : (
          <Tag>Vencido</Tag>
        ),
    },
    {
      title: "",
      key: "acciones",
      width: 60,
      render: (_, r) =>
        r.oculto ? (
          <Tooltip title="Volver a mostrar">
            <Button
              size="small"
              icon={<EyeOutlined />}
              aria-label="Volver a mostrar"
              onClick={(e) => {
                e.stopPropagation();
                cambiarVisibilidad(r, false);
              }}
            />
          </Tooltip>
        ) : (
          <Tooltip title="Ocultar del mapa">
            <Button
              size="small"
              danger
              icon={<EyeInvisibleOutlined />}
              aria-label="Ocultar del mapa"
              onClick={(e) => {
                e.stopPropagation();
                setModerando(r);
              }}
            />
          </Tooltip>
        ),
    },
  ];

  return (
    <>
      <Table
        rowKey="id"
        size="small"
        columns={columnas}
        dataSource={filas ?? []}
        loading={cargando}
        scroll={{ x: 760 }}
        pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
        onRow={(r) => ({ onClick: () => abrirUsuario(r.usuario_id), style: { cursor: "pointer" } })}
        locale={{ emptyText: "No hay reportes en este periodo" }}
      />
      <Modal
        open={!!moderando}
        title="Ocultar reporte del mapa"
        okText="Ocultar"
        okButtonProps={{ danger: true, disabled: motivo.trim().length < 5 }}
        confirmLoading={guardando}
        onOk={() => cambiarVisibilidad(moderando, true, motivo.trim())}
        onCancel={() => setModerando(null)}
        centered
      >
        <p>Deja de contar en el mapa de inmediato. Queda registrado en la auditoría.</p>
        <Input.TextArea
          rows={3}
          maxLength={300}
          placeholder="Motivo (ej.: varias denuncias, contradice a todos los vecinos)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          aria-label="Motivo"
        />
      </Modal>
    </>
  );
}
