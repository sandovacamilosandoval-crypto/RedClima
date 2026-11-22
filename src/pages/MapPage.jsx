import React, { useState, useEffect, useCallback, useRef } from "react";
import { App, Layout, Modal, Spin, Button } from "antd";
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
  TILES_URL,
  TILES_ATRIBUCION,
  distanciaMetros,
} from "../constants/clima";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/errores";
import { useAuth } from "../context/AuthContext";
import "./MapPage.css";

const { Content } = Layout;

// Centra el mapa solo la primera vez que llega tu ubicación (y tras "Reintentar"),
// para no pelear con el usuario cuando mueve el mapa mientras el GPS se actualiza.
function RecenterMap({ coords, intento }) {
  const map = useMap();
  const centradoEn = useRef(null);
  useEffect(() => {
    if (coords && centradoEn.current !== intento) {
      centradoEn.current = intento;
      map.setView([coords.lat, coords.lng], 15);
    }
  }, [coords, intento, map]);
  return null;
}

const OPCIONES_GPS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };

const TEXTO_ERROR_GPS = {
  1: "Bloqueaste el acceso a tu ubicación. Actívalo en los ajustes del navegador (en iPhone: Ajustes › Privacidad › Localización) y vuelve a intentarlo.",
  2: "No pudimos determinar tu ubicación. Activa el GPS o sal a un lugar con mejor señal.",
  3: "Tu ubicación tardó demasiado en llegar. Revisa que el GPS esté activo e inténtalo de nuevo.",
  "sin-soporte": "Tu navegador no permite obtener la ubicación. Prueba con otro navegador.",
};

// Redondeo a ~100 m: las zonas solo se vuelven a pedir si te moviste de verdad
const redondear = (v) => (v === undefined ? undefined : Math.round(v * 1000) / 1000);

function MapPage() {
  const { refrescarPerfil } = useAuth();
  const { message } = App.useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false); // evita dobles envíos antes de que React re-renderice

  // GPS: se sigue la ubicación mientras la página está abierta
  const [ubicacion, setUbicacion] = useState(null);
  const [gpsError, setGpsError] = useState(() => (navigator.geolocation ? null : "sin-soporte"));
  const [intentoGps, setIntentoGps] = useState(0);
  const gpsEstado = ubicacion ? "ok" : gpsError ? "error" : "buscando";

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

  // Al volver a la pestaña, los temporizadores pudieron estar dormidos: refrescar ya
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === "visible") {
        setAhora(Date.now());
        setRecarga((r) => r + 1);
      }
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUbicacion({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: pos.coords.accuracy,
        });
        setGpsError(null);
      },
      (err) => setGpsError(err.code),
      OPCIONES_GPS
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [intentoGps]);

  const reintentarGps = useCallback(() => {
    setGpsError(navigator.geolocation ? null : "sin-soporte");
    setIntentoGps((n) => n + 1);
  }, []);

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
  const lat = redondear(ubicacion?.lat);
  const lng = redondear(ubicacion?.lng);
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
      if (!error) {
        setZonas(data ?? []);
      } else if (error.code === "P0001") {
        // El servidor dice que tu reporte ya venció (p. ej. reloj del celular adelantado)
        setReporteActivoHasta(null);
        setZonas([]);
      } else {
        message.error(mensajeError(error, "No pudimos cargar las zonas. Revisa tu conexión."));
      }
    };
    cargar();
    const id = setInterval(cargar, REFRESCO_ZONAS_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [lat, lng, desbloqueado, recarga, message]);

  const enviarReporte = async (clima) => {
    if (enviandoRef.current) return;
    if (!ubicacion) {
      message.error("Necesitamos tu ubicación para reportar.");
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("crear_reporte", {
        p_tipo: clima.id,
        p_lat: ubicacion.lat,
        p_lng: ubicacion.lng,
        p_precision_m: Math.round(ubicacion.precision),
      });
      if (error) {
        message.error(mensajeError(error, "No pudimos guardar tu reporte. Inténtalo de nuevo."));
        return;
      }
      setIsModalOpen(false);
      setConfirmData(null);
      setAhora(Date.now());
      setReporteActivoHasta(new Date(data.expira_en).getTime());
      setRecarga((r) => r + 1);
      message.success(`¡Gracias! Reportaste ${clima.label.toLowerCase()} (+10 XP)`);
      // El XP se actualiza en segundo plano; si falla, no afecta al reporte
      refrescarPerfil().catch(() => {});
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const handleReportSelection = (clima) => {
    if (enviandoRef.current) return;
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

  if (gpsEstado === "buscando") {
    return (
      <div className="loading-screen" role="status">
        <Spin size="large" />
        <p>Obteniendo tu ubicación...</p>
      </div>
    );
  }

  const centro = ubicacion || UBICACION_DEFECTO;
  const textoErrorGps = TEXTO_ERROR_GPS[gpsError] ?? TEXTO_ERROR_GPS[2];

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
            <TileLayer url={TILES_URL} maxZoom={19} attribution={TILES_ATRIBUCION} />
            <RecenterMap coords={ubicacion} intento={intentoGps} />
            {desbloqueado &&
              zonas.map((z, i) => (
                <ZonaClima key={`${z.lat},${z.lng},${i}`} zona={z} ahora={ahora} />
              ))}
          </MapContainer>

          {/* Mapa desbloqueado pero sin GPS: avisar en vez de mostrar un mapa vacío */}
          {desbloqueado && gpsEstado === "error" && (
            <div className="gps-aviso" role="alert">
              <span>{textoErrorGps}</span>
              <Button size="small" type="primary" onClick={reintentarGps}>
                Reintentar
              </Button>
            </div>
          )}

          {!desbloqueado && (
            <div className="lock-overlay">
              <div className="lock-card">
                {gpsEstado === "error" ? (
                  <>
                    <span className="lock-emoji" aria-hidden="true">📍</span>
                    <h3>Activa tu ubicación</h3>
                    <p>{textoErrorGps}</p>
                    <Button type="primary" size="large" className="btn-unlock" onClick={reintentarGps}>
                      Reintentar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="lock-emoji" aria-hidden="true">👀</span>
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
          <ClimateMenu onSelect={handleReportSelection} onCancel={() => setIsModalOpen(false)} disabled={enviando} />
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
