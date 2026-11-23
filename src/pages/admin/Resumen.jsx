import React, { useState } from "react";
import { Alert, Card, Col, Input, Row, Segmented, Spin, Statistic, Tag } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { CLIMAS } from "../../constants/clima";
import { NIVELES } from "../../constants/niveles";
import { mensajeError } from "../../lib/errores";
import TablaReportes from "./TablaReportes";
import { PERIODOS, nombrePeriodo, useAdmin, useRpc } from "./comun";

function Variacion({ actual, anterior }) {
  if (anterior == null || anterior === 0) return null;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  if (pct === 0) return <span className="kpi-var">= periodo anterior</span>;
  const sube = pct > 0;
  return (
    <span className={`kpi-var ${sube ? "sube" : "baja"}`}>
      {sube ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(pct)}% vs. periodo anterior
    </span>
  );
}

// Barras simples (sin librería de gráficas)
function Barras({ valores, etiquetas, color = "#1d63d6", alto = 120 }) {
  const max = Math.max(1, ...valores);
  return (
    <div className="barras" style={{ height: alto }} role="img" aria-label={etiquetas.map((e, i) => `${e}: ${valores[i]}`).join(", ")}>
      {valores.map((v, i) => (
        <div key={i} className="barra-col" title={`${etiquetas[i]}: ${v}`}>
          <div className="barra" style={{ height: `${(v / max) * 100}%`, background: color }} />
          <span className="barra-etq">{etiquetas[i]}</span>
        </div>
      ))}
    </div>
  );
}

export default function Resumen() {
  const { abrirUsuario } = useAdmin();
  const [horas, setHoras] = useState(24);
  const [busqueda, setBusqueda] = useState("");
  const { data: r, error, cargando } = useRpc("admin_resumen", { p_horas: horas });

  return (
    <div className="admin-pagina">
      <div className="admin-encabezado">
        <h1>Resumen</h1>
        <Segmented options={PERIODOS} value={horas} onChange={setHoras} aria-label="Periodo" />
      </div>

      {error && <Alert type="error" showIcon title={mensajeError(error, "No pudimos cargar el resumen")} />}

      <Spin spinning={cargando}>
        {r && (
          <>
            {(r.tickets_urgentes > 0 || r.tickets_sin_respuesta_24h > 0) && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title={`Soporte: ${r.tickets_urgentes} caso(s) urgente(s) y ${r.tickets_sin_respuesta_24h} sin respuesta hace más de 24 h.`}
              />
            )}

            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic title="Reportes" value={r.reportes} />
                  <Variacion actual={r.reportes} anterior={r.reportes_periodo_anterior} />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic title="Reporteros activos" value={r.reporteros} />
                  <Variacion actual={r.reporteros} anterior={r.reporteros_periodo_anterior} />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic title="Usuarios nuevos" value={r.nuevos} suffix={`/ ${r.usuarios_total}`} />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Nuevos que ya reportaron"
                    value={r.embudo_primer_reporte ?? "—"}
                    suffix={r.embudo_primer_reporte != null ? "%" : ""}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Retención semanal"
                    value={r.retencion_semanal ?? "—"}
                    suffix={r.retencion_semanal != null ? "%" : ""}
                  />
                  <span className="kpi-var">reporteros que volvieron esta semana</span>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic title="Casos abiertos" value={r.tickets_abiertos} />
                  <span className={`kpi-var ${r.tickets_urgentes ? "baja" : ""}`}>
                    {r.tickets_urgentes ? `${r.tickets_urgentes} urgente(s)` : "ninguno urgente"}
                  </span>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Primera respuesta (mediana)"
                    value={r.horas_primera_respuesta ?? "—"}
                    suffix={r.horas_primera_respuesta != null ? "h" : ""}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small">
                  <Statistic title="Reportes ocultos" value={r.ocultos} />
                  <span className="kpi-var">
                    {r.suspendidos} {r.suspendidos === 1 ? "cuenta suspendida" : "cuentas suspendidas"}
                  </span>
                </Card>
              </Col>
            </Row>

            <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
              <Col xs={24} lg={12}>
                <Card size="small" title={`Reportes por hora del día (${nombrePeriodo(horas)})`}>
                  <Barras valores={r.por_hora ?? []} etiquetas={(r.por_hora ?? []).map((_, i) => String(i))} />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small" title="Por tipo de clima">
                  <Barras
                    valores={CLIMAS.map((c) => r.por_tipo?.[c.id] ?? 0)}
                    etiquetas={CLIMAS.map((c) => c.label)}
                    color="#3498db"
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card size="small" title="Usuarios por nivel">
                  <Barras valores={r.niveles ?? []} etiquetas={NIVELES.map((n) => n.nombre.slice(0, 5))} color="#7c3aed" />
                </Card>
              </Col>
            </Row>

            <Card size="small" title={`Reporteros más activos (${nombrePeriodo(horas)})`} style={{ marginTop: 12 }}>
              {r.top_reporteros?.length ? (
                <div className="top-lista">
                  {r.top_reporteros.map((u, i) => (
                    <button key={u.id} type="button" className="top-item" onClick={() => abrirUsuario(u.id)}>
                      <span className="top-pos">{i + 1}</span>
                      <span>@{u.username} {u.verificado && <Tag color="blue">Verificado</Tag>}</span>
                      <strong>{u.reportes}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="admin-vacio">Nadie ha reportado en este periodo.</p>
              )}
            </Card>
          </>
        )}
      </Spin>

      <Card
        size="small"
        style={{ marginTop: 12 }}
        title={`Reportes de ${nombrePeriodo(horas)}`}
        extra={
          <Input.Search
            allowClear
            placeholder="Buscar usuario o clima"
            onSearch={setBusqueda}
            style={{ width: 220 }}
            aria-label="Buscar reportes"
          />
        }
      >
        <p className="admin-ayuda">Toca un reporte para ver quién lo hizo y todos sus reportes.</p>
        <TablaReportes horas={horas} busqueda={busqueda} />
      </Card>
    </div>
  );
}
