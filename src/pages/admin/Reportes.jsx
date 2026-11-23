import React, { useMemo, useState } from "react";
import { Card, Checkbox, Input, Segmented, Space } from "antd";
import { useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { CLIMA_POR_ID, TILES_URL, TILES_ATRIBUCION, UBICACION_DEFECTO } from "../../constants/clima";
import { haceCuanto } from "../../lib/formato";
import TablaReportes from "./TablaReportes";
import { PERIODOS, nombrePeriodo, useAdmin, useRpc } from "./comun";

export default function Reportes() {
  const { abrirUsuario } = useAdmin();
  const [params] = useSearchParams();
  // Llegando desde un caso de soporte: centrar en la zona denunciada
  const latParam = params.get("lat");
  const lngParam = params.get("lng");
  const zona = useMemo(
    () => (latParam && lngParam ? { lat: Number(latParam), lng: Number(lngParam) } : null),
    [latParam, lngParam]
  );
  const [horas, setHoras] = useState(zona ? 1 : 24);
  const [busqueda, setBusqueda] = useState("");
  const [soloOcultos, setSoloOcultos] = useState(false);
  const { data, cargando, recargar } = useRpc("admin_reportes", {
    p_horas: horas,
    p_solo_ocultos: soloOcultos,
    p_limite: 500,
    p_busqueda: busqueda || null,
  });
  const [ahora] = useState(() => Date.now());

  const centro = useMemo(() => zona ?? (data?.[0] ? { lat: data[0].lat, lng: data[0].lng } : UBICACION_DEFECTO), [zona, data]);

  return (
    <div className="admin-pagina">
      <div className="admin-encabezado">
        <h1>Reportes</h1>
        <Segmented options={PERIODOS} value={horas} onChange={setHoras} aria-label="Periodo" />
      </div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <div className="admin-mapa">
          {!cargando && (
            <MapContainer key={`${centro.lat},${centro.lng}`} center={[centro.lat, centro.lng]} zoom={zona ? 15 : 12} style={{ height: "100%", width: "100%" }}>
              <TileLayer url={TILES_URL} maxZoom={19} attribution={TILES_ATRIBUCION} />
              {(data ?? []).map((r) => (
                <CircleMarker
                  key={r.id}
                  center={[r.lat, r.lng]}
                  radius={7}
                  pathOptions={{
                    color: r.oculto ? "#b42318" : "#fff",
                    weight: r.oculto ? 3 : 1,
                    fillColor: CLIMA_POR_ID[r.tipo]?.color,
                    fillOpacity: r.oculto ? 0.35 : 0.85,
                  }}
                  eventHandlers={{ click: () => abrirUsuario(r.usuario_id) }}
                >
                  <LTooltip>
                    {CLIMA_POR_ID[r.tipo]?.label} · @{r.username} · {haceCuanto(r.creado_en, ahora)}
                    {r.oculto ? " · OCULTO" : ""}
                  </LTooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>
        <p className="admin-ayuda">
          {data?.length ?? 0} reportes en {nombrePeriodo(horas)}. Toca un punto para ver a quien reportó. Borde rojo = oculto.
        </p>
      </Card>
      <Card
        size="small"
        title="Listado"
        extra={
          <Space wrap>
            <Checkbox checked={soloOcultos} onChange={(e) => setSoloOcultos(e.target.checked)}>
              Solo ocultos
            </Checkbox>
            <Input.Search allowClear placeholder="Buscar usuario o clima" onSearch={setBusqueda} style={{ width: 220 }} aria-label="Buscar reportes" />
          </Space>
        }
      >
        <TablaReportes horas={horas} datos={data ?? []} onCambio={recargar} />
      </Card>
    </div>
  );
}
