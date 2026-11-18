import React, { useState, useEffect, useRef } from "react";
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
  RADIO_ZONA_INICIAL,
  EXPANSION_ZONA,
  DURACION_REPORTE_MS,
  XP_POR_REPORTE,
  UBICACION_DEFECTO,
  distanciaMetros,
} from "../constants/clima";
import "./MapPage.css";

const { Content } = Layout;

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], 15);
  }, [coords, map]);
  return null;
}

// Guarda el reporte en el historial local y suma XP / contador al perfil.
// TODO: cuando exista backend, esto lo debe registrar el servidor.
function registrarEnHistorial(tipo, coords) {
  const historial = JSON.parse(localStorage.getItem("historial_reportes") || "[]");
  historial.unshift({
    id: Date.now(),
    tipo: CLIMA_POR_ID[tipo]?.label || tipo,
    ubicacion: `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`,
    fecha: new Date().toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }),
  });
  localStorage.setItem("historial_reportes", JSON.stringify(historial.slice(0, 50)));

  const count = parseInt(localStorage.getItem("user_reports_count") || "0", 10) + 1;
  const xp = parseInt(localStorage.getItem("user_xp") || "0", 10) + XP_POR_REPORTE;
  localStorage.setItem("user_reports_count", String(count));
  localStorage.setItem("user_xp", String(xp));
}

function MapPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState(
    () => localStorage.getItem("username") || "Usuario_RedClima"
  );

  const [reportes, setReportes] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasReported, setHasReported] = useState(false);
  const timersRef = useRef({});

  useEffect(() => {
    const usarDefecto = () => {
      message.error("No pudimos obtener tu ubicación. Usando Bogotá por defecto.");
      setUserLocation(UBICACION_DEFECTO);
      setLoading(false);
    };

    if (!navigator.geolocation) {
      usarDefecto();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      usarDefecto,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Limpia los temporizadores pendientes al salir de la página
  useEffect(() => {
    const timers = timersRef.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const handleOpenMenu = () => {
    setNombreUsuario(localStorage.getItem("username") || "Usuario_RedClima");
    setIsMenuOpen(true);
  };

  const generarNuevaZona = (tipoClima, coordenadas, idExistente = null, tamaño = RADIO_ZONA_INICIAL) => {
    const id = idExistente || Date.now();
    const nuevoReporte = {
      id,
      tipo: tipoClima,
      coords: { lat: coordenadas.lat, lng: coordenadas.lng },
      size: tamaño,
    };

    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    if (idExistente) {
      setReportes((prev) => prev.map((rep) => (rep.id === id ? nuevoReporte : rep)));
    } else {
      setReportes((prev) => [...prev, nuevoReporte]);
    }

    registrarEnHistorial(tipoClima, coordenadas);
    setIsModalOpen(false);
    setConfirmData(null);
    setHasReported(true);

    // El reporte caduca: el clima cambia, la información vieja no sirve
    timersRef.current[id] = setTimeout(() => {
      setReportes((prev) => prev.filter((rep) => rep.id !== id));
      delete timersRef.current[id];
    }, DURACION_REPORTE_MS);
  };

  const handleReportSelection = (clima) => {
    if (!userLocation) return;

    // ¿El usuario está dentro de una zona ya reportada?
    const reporteCercano = reportes.find(
      (r) => distanciaMetros(r.coords, userLocation) <= (r.size || RADIO_ZONA_INICIAL)
    );

    if (reporteCercano) {
      setConfirmData({ clima, reporte: reporteCercano });
      setIsModalOpen(false);
    } else {
      generarNuevaZona(clima.id, userLocation);
      message.success(`Reporte de ${clima.label} creado`);
    }
  };

  const handleConfirm = () => {
    const { clima, reporte } = confirmData;
    if (reporte.tipo === clima.id) {
      generarNuevaZona(clima.id, reporte.coords, reporte.id, (reporte.size || RADIO_ZONA_INICIAL) + EXPANSION_ZONA);
      message.success("¡Zona de clima expandida!");
    } else {
      generarNuevaZona(clima.id, userLocation, reporte.id, RADIO_ZONA_INICIAL);
      message.warning("Clima actualizado en esta zona");
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <Spin size="large" />
        <p>Obteniendo tu ubicación...</p>
      </div>
    );
  }

  return (
    <Layout className="map-layout">
      <Button
        className="btn-hamburguesa"
        shape="circle"
        icon={<MenuOutlined />}
        onClick={handleOpenMenu}
        aria-label="Abrir menú"
      />

      <Content className="main-content">
        <div className={`map-wrapper ${!hasReported ? "is-locked" : ""}`}>
          <MapContainer
            center={[userLocation.lat, userLocation.lng]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              // CARTO (basemaps.cartocdn.com) ahora exige API key; OSM es libre con atribución.
              // Para producción con mucho tráfico conviene un proveedor con plan (MapTiler, Stadia...).
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <RecenterMap coords={userLocation} />
            {reportes.map((rep) => (
              <ZonaClima key={rep.id} reporte={rep} />
            ))}
          </MapContainer>

          {!hasReported && (
            <div className="lock-overlay">
              <div className="lock-card">
                <span className="lock-emoji">👀</span>
                <h3>¿Quieres ver el mapa?</h3>
                <p>¡Comparte el clima actual en tu zona para desbloquear la vista!</p>
                <Button type="primary" size="large" className="btn-unlock" onClick={() => setIsModalOpen(true)}>
                  ¡Reportar ahora!
                </Button>
              </div>
            </div>
          )}
        </div>
      </Content>

      {hasReported && <ReportButton onClick={() => setIsModalOpen(true)} />}

      <Modal open={isMenuOpen} onCancel={() => setIsMenuOpen(false)} footer={null} centered width={350} closable={false} destroyOnHidden>
        <UserProfileMenu userFromLogin={nombreUsuario} onCancel={() => setIsMenuOpen(false)} />
      </Modal>

      <Modal open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null} centered width={350} closable={false}>
        <ClimateMenu onSelect={handleReportSelection} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <Modal open={!!confirmData} onCancel={() => setConfirmData(null)} footer={null} centered width={320} closable={false}>
        {confirmData && (
          <ConfirmReport
            climaLabel={confirmData.clima.label}
            onCancel={() => setConfirmData(null)}
            onConfirm={handleConfirm}
          />
        )}
      </Modal>
    </Layout>
  );
}

export default MapPage;
