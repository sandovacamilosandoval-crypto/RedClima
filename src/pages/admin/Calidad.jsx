import React, { useState } from "react";
import { Alert, Card, Segmented, Table, Tag } from "antd";
import { mensajeError } from "../../lib/errores";
import { useAdmin, useRpc } from "./comun";

const TIPOS = {
  velocidad: { texto: "Velocidad imposible", color: "red", ayuda: "Reportó en dos lugares tan lejanos que habría viajado a más de 150 km/h. Suele indicar ubicación falsa." },
  desacuerdo: { texto: "Desacuerdo con vecinos", color: "orange", ayuda: "Sus reportes casi nunca coinciden con los de otras personas cercanas en el mismo momento." },
  precision_fija: { texto: "Precisión idéntica", color: "purple", ayuda: "Todos sus reportes tienen exactamente la misma precisión de GPS: típico de apps que falsean la ubicación." },
};

export default function Calidad() {
  const { abrirUsuario } = useAdmin();
  const [dias, setDias] = useState(7);
  const { data, error, cargando } = useRpc("admin_anomalias", { p_dias: dias });

  return (
    <div className="admin-pagina">
      <div className="admin-encabezado">
        <h1>Calidad del dato</h1>
        <Segmented
          aria-label="Periodo"
          value={dias}
          onChange={setDias}
          options={[
            { label: "1 día", value: 1 },
            { label: "1 semana", value: 7 },
            { label: "1 mes", value: 30 },
          ]}
        />
      </div>
      {error && <Alert type="error" showIcon title={mensajeError(error, "No pudimos revisar las anomalías")} />}
      <Card size="small" title="Comportamiento anómalo">
        <ul className="admin-ayuda-lista">
          {Object.values(TIPOS).map((t) => (
            <li key={t.texto}>
              <Tag color={t.color}>{t.texto}</Tag> {t.ayuda}
            </li>
          ))}
        </ul>
        <Table
          rowKey={(r) => `${r.usuario_id}-${r.tipo}`}
          size="small"
          loading={cargando}
          dataSource={data ?? []}
          pagination={false}
          scroll={{ x: 560 }}
          onRow={(r) => ({ onClick: () => abrirUsuario(r.usuario_id), style: { cursor: "pointer" } })}
          locale={{ emptyText: "Sin anomalías en este periodo ✅" }}
          columns={[
            { title: "Usuario", dataIndex: "username", render: (u) => `@${u}` },
            { title: "Señal", dataIndex: "tipo", width: 190, render: (t) => <Tag color={TIPOS[t]?.color}>{TIPOS[t]?.texto ?? t}</Tag> },
            { title: "Detalle", dataIndex: "detalle" },
          ]}
        />
      </Card>
    </div>
  );
}
