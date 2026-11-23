import React, { useState } from "react";
import { Card, Input, Select, Space, Table, Tag } from "antd";
import { formatearFecha } from "../../lib/formato";
import { infoNivel } from "../../constants/niveles";
import { ESTADOS_CUENTA, useAdmin, useRpc } from "./comun";

const POR_PAGINA = 25;

export default function Usuarios() {
  const { abrirUsuario } = useAdmin();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState(null);
  const [pagina, setPagina] = useState(1);
  const { data, cargando } = useRpc("admin_usuarios", {
    p_busqueda: busqueda || null,
    p_estado: estado,
    p_limite: POR_PAGINA,
    p_offset: (pagina - 1) * POR_PAGINA,
  });

  const columnas = [
    {
      title: "Usuario",
      dataIndex: "username",
      render: (u, r) => (
        <span>
          @{u} {r.verificado && <Tag color="blue">✔</Tag>} {r.rol && <Tag color="purple">{r.rol}</Tag>}
        </span>
      ),
    },
    {
      title: "Nivel",
      dataIndex: "xp",
      width: 130,
      render: (xp) => {
        const n = infoNivel(xp).actual;
        return <Tag color={n.color}>{n.nivel} · {n.nombre}</Tag>;
      },
    },
    { title: "Reportes", dataIndex: "total_reportes", width: 90 },
    { title: "7 días", dataIndex: "reportes_7d", width: 70 },
    { title: "Casos", dataIndex: "tickets_abiertos", width: 70, render: (n) => (n ? <Tag color="orange">{n}</Tag> : 0) },
    {
      title: "Estado",
      dataIndex: "estado",
      width: 110,
      render: (e) => <Tag color={ESTADOS_CUENTA[e]?.color}>{ESTADOS_CUENTA[e]?.texto}</Tag>,
    },
    { title: "Registro", dataIndex: "creado_en", width: 140, render: formatearFecha },
    { title: "Último acceso", dataIndex: "ultimo_acceso", width: 140, render: (v) => (v ? formatearFecha(v) : "—") },
  ];

  return (
    <div className="admin-pagina">
      <div className="admin-encabezado">
        <h1>Usuarios</h1>
      </div>
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="Buscar por usuario (o correo, si eres admin)"
            onSearch={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            style={{ width: 300 }}
            aria-label="Buscar usuarios"
          />
          <Select
            allowClear
            placeholder="Estado"
            aria-label="Filtrar por estado"
            style={{ width: 160 }}
            value={estado}
            onChange={(v) => {
              setEstado(v ?? null);
              setPagina(1);
            }}
            options={[
              ...Object.entries(ESTADOS_CUENTA).map(([value, e]) => ({ value, label: e.texto })),
              { value: "verificado", label: "Verificados" },
            ]}
          />
        </Space>
        <Table
          rowKey="id"
          size="small"
          loading={cargando}
          columns={columnas}
          dataSource={data ?? []}
          scroll={{ x: 900 }}
          onRow={(r) => ({ onClick: () => abrirUsuario(r.id), style: { cursor: "pointer" } })}
          pagination={{
            current: pagina,
            pageSize: POR_PAGINA,
            total: data?.[0]?.total ?? 0,
            onChange: setPagina,
            showSizeChanger: false,
            hideOnSinglePage: true,
          }}
          locale={{ emptyText: "No hay usuarios con estos filtros" }}
        />
      </Card>
    </div>
  );
}
