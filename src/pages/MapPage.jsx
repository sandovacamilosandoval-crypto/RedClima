import React, { useState, useEffect, useCallback } from "react";
import { Layout, Modal, message, Spin, Button } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import ReportButton from "../components/ReportButton/ReportButton";
import ClimateMenu from "../components/ClimateMenu/ClimateMenu";
import ZonaClima from "../components/ZonaClima/ZonaClima";
import ConfirmReport from "../components/ConfirmReport/ConfirmReport";
import UserProfileMenu from "../components/UserProfileMenu";
import {
  CLIMA_POR_ID,
  UBICACION_DEFECTO,
  RADIO_BUSQUEDA_M,
  REFRESCO_ZONAS_MS,
  distanciaMetros,
} from "../constants/clima";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import "./MapPage.css";

const { Content } = Layout;

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], 15);
  }, [coords, map]);
  return null;
}

const OPCIONES_GPS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };

function MapPage() {
  const { refrescarPerfil } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // GPS: 'buscando' | 'ok' | 'error'
  const [gpsEstado, setGpsEstado] = useState(() =>
    navigator.geolocation ? "buscando" : "error"
  );
  const [ubicacion, setUbicacion] = useState(null);

  // Hasta cuándo está desbloqueado el mapa (vence con tu último reporte)
  const [reporteActivoHasta, setReporteActivoHasta] = useState(null);
  const [zonas, setZonas] = useState([]);
  const [recarga, setRecarga] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());

  const desbloqueado = reporteActivoHasta !== null && reporteActivoHasta > ahora;

  // Reloj para vencer reportes y mostrar "hace X min"
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const pedirUbicacion = useCallback(() => {
    if (!navigator.geolocation) return; // el estado inicial ya es "error"
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: pos.coords.accuracy,
        });
        setGpsEstado("ok");
      },
      () => setGpsEstado("error"),
      OPCIONES_GPS
    );
  }, []);

  useEffect(() => {
    pedirUbicacion();
  }, [pedirUbicacion]);

  // ¿Tengo un reporte vigente? (desbloquea el mapa tras recargar la página)
  useEffect(() => {
    let activo = true;
    supabase
      .from("reportes")
      .select("expira_en")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (activo && data) setReporteActivoHasta(new Date(data.expira_en).getTime());
      });
    return () => {
      activo = false;
    };
  }, []);

  // Zonas compartidas de toda la comunidad
  const lat = ubicacion?.lat;
  const lng = ubicacion?.lng;
  useEffect(() => {
    if (lat === undefined || !desbloqueado) return;
    let activo = true;
    const cargar = async () => {
      const { data, error } = await supabase.rpc("zonas_cercanas", {
        p_lat: lat,
        p_lng: lng,
        p_radio_m: RADIO_BUSQUEDA_M,
      });
      if (!activo) return;
      if (error) message.error("No pudimos cargar las zonas. Revisa tu conexión.");
      else setZonas(data);
    };
    cargar();
    const id = setInterval(cargar, REFRESCO_ZONAS_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [lat, lng, desbloqueado, recarga]);

  const enviarReporte = async (clima) => {
    setEnviando(true);
    const { data, error } = await supabase.rpc("crear_reporte", {
      p_tipo: clima.id,
      p_lat: ubicacion.lat,
      p_lng: ubicacion.lng,
      p_precision_m: Math.round(ubicacion.precision),
    });
    setEnviando(false);

    if (error) {
      message.error(error.message);
      return;
    }
    setIsModalOpen(false);
    setConfirmData(null);
    setAhora(Date.now());
    setReporteActivoHasta(new Date(data.expira_en).getTime());
    setRecarga((r) => r + 1);
    refrescarPerfil();
    message.success(`¡Gracias! Reportaste ${clima.label.toLowerCase()} (+10 XP)`);
  };

  const handleReportSelection = (clima) => {
    if (!ubicacion) {
      message.error("Necesitamos tu ubicación para reportar.");
      return;
    }
    const zonaActual = zonas.find((z) => distanciaMetros(z, ubicacion) <= z.radio_m);
    if (zonaActual) {
      setConfirmData({ clima, zona: zonaActual });
      setIsModalOpen(false);
    } else {
      enviarReporte(clima);
    }
  };

  if (gpsEstado === "buscando" && !ubicacion) {
    return (
      <div className="loading-screen">
        <Spin size="large" />
        <p>Obteniendo tu ubicación...</p>
      </div>
    );
  }

  const centro = ubicacion || UBICACION_DEFECTO;

  return (
    <Layout className="map-layout">
      <Button
        className="btn-hamburguesa"
        shape="circle"
        icon={<MenuOutlined />}
        onClick={() => setIsMenuOpen(true)}
        aria-label="Abrir menú"
      />

      <Content className="main-content">
        <div className={`map-wrapper ${!desbloqueado ? "is-locked" : ""}`}>
          <MapContainer
            center={[centro.lat, centro.lng]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            {/* CARTO ahora exige API key; OSM es libre con atribución.
                Para producción con mucho tráfico conviene un proveedor con plan (MapTiler, Stadia...). */}
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <RecenterMap coords={ubicacion} />
            {desbloqueado &&
              zonas.map((z) => (
                <ZonaClima key={`${z.lat},${z.lng},${z.tipo}`} zona={z} ahora={ahora} />
              ))}
          </MapContainer>

          {!desbloqueado && (
            <div className="lock-overlay">
              <div className="lock-card">
                {gpsEstado === "error" ? (
                  <>
                    <span className="lock-emoji">📍</span>
                    <h3>Activa tu ubicación</h3>
                    <p>
                      Para reportar el clima necesitamos saber dónde estás. Permite el acceso a
                      la ubicación en tu navegador e inténtalo de nuevo.
                    </p>
                    <Button
                      type="primary"
                      size="large"
                      className="btn-unlock"
                      onClick={() => {
                        setGpsEstado("buscando");
                        pedirUbicacion();
                      }}
                    >
                      Reintentar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="lock-emoji">👀</span>
                    <h3>¿Quieres ver el mapa?</h3>
                    <p>¡Comparte el clima actual en tu zona para desbloquear la vista durante 1 hora!</p>
                    <Button type="primary" size="large" className="btn-unlock" onClick={() => setIsModalOpen(true)}>
                      ¡Reportar ahora!
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Content>

      {desbloqueado && <ReportButton onClick={() => setIsModalOpen(true)} />}

      <Modal open={isMenuOpen} onCancel={() => setIsMenuOpen(false)} footer={null} centered width={350} closable={false} destroyOnHidden>
        <UserProfileMenu onCancel={() => setIsMenuOpen(false)} />
      </Modal>

      <Modal open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null} centered width={350} closable={false}>
        <Spin spinning={enviando}>
          <ClimateMenu onSelect={handleReportSelection} onCancel={() => setIsModalOpen(false)} />
        </Spin>
      </Modal>

      <Modal open={!!confirmData} onCancel={() => setConfirmData(null)} footer={null} centered width={320} closable={false}>
        {confirmData && (
          <ConfirmReport
            climaLabel={confirmData.clima.label}
            zonaLabel={CLIMA_POR_ID[confirmData.zona.tipo]?.label}
            loading={enviando}
            onCancel={() => setConfirmData(null)}
            onConfirm={() => enviarReporte(confirmData.clima)}
          />
        )}
      </Modal>
    </Layout>
  );
}

export default MapPage;
