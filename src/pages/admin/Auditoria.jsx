import React from "react";
import { Alert, Button, Card, Table } from "antd";
import { formatearFecha } from "../../lib/formato";
import { mensajeError } from "../../lib/errores";
import { useAdmin, useRpc } from "./comun";

export default function Auditoria() {
  const { abrirUsuario } = useAdmin();
  const { data, error, cargando } = useRpc("admin_auditoria", { p_limite: 300 });
  return (
    <div className="admin-pagina">
      <div className="admin-encabezado">
        <h1>Auditoría</h1>
      </div>
      {error && <Alert type="error" showIcon title={mensajeError(error, "No pudimos cargar la auditoría")} />}
      <Card size="small">
        <p className="admin-ayuda">Registro de todas las acciones del equipo. No se puede editar ni borrar.</p>
        <Table
          rowKey="id"
          size="small"
          loading={cargando}
          dataSource={data ?? []}
          scroll={{ x: 760 }}
          pagination={{ pageSize: 30, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText: "Aún no hay acciones registradas" }}
          columns={[
            { title: "Fecha", dataIndex: "creado_en", width: 150, render: formatearFecha },
            { title: "Por", dataIndex: "staff_username", width: 130, render: (v) => (v ? `@${v}` : "—") },
            { title: "Acción", dataIndex: "accion", width: 150 },
            {
              title: "Sobre",
              key: "sobre",
              render: (_, a) =>
                a.username ? (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => abrirUsuario(a.usuario_id)}>
                    @{a.username}
                  </Button>
                ) : a.ticket_id ? (
                  `Caso #${a.ticket_id}`
                ) : (
                  "—"
                ),
            },
            { title: "Motivo", dataIndex: "motivo" },
          ]}
        />
      </Card>
    </div>
  );
}
