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
import "./MapPage.css";

const { Content } = Layout;

function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], 15);
  }, [coords, map]);
  return null;
}

function MapPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState("");

  const [reportes, setReportes] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasReported, setHasReported] = useState(false);
  const timersRef = useRef({});

  useEffect(() => {
    const savedName = localStorage.getItem("username") || "Usuario_RedClima";
    setNombreUsuario(savedName);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      () => {
        message.error("Error de ubicación. Usando Bogotá por defecto.");
        setUserLocation({ lat: 4.6097, lng: -74.0817 });
        setLoading(false);
      }
    );
  }, []);

  const handleOpenMenu = () => {
    const freshName = localStorage.getItem("username") || "Usuario_RedClima";
    setNombreUsuario(freshName);
    setIsMenuOpen(true);
  };

  const generarNuevaZona = (tipoClima, coordenadas, idExistente = null, tamañoActual = 250) => {
    const id = idExistente || Date.now();
    const nuevoReporte = {
      id, tipo: tipoClima,
      coords: { lat: coordenadas.lat, lng: coordenadas.lng },
      size: tamañoActual
    };

    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    if (idExistente) {
      setReportes((prev) => prev.map((rep) => (rep.id === id ? nuevoReporte : rep)));
    } else {
      setReportes((prev) => [...prev, nuevoReporte]);
    }

    setIsModalOpen(false);
    setConfirmData(null);
    setHasReported(true);

    timersRef.current[id] = setTimeout(() => {
      setReportes((prev) => {
        const nuevosReportes = prev.filter((rep) => rep.id !== id);
        if (nuevosReportes.length === 0) setHasReported(false);
        return nuevosReportes;
      });
      delete timersRef.current[id];
    }, 1000000);
  };

  const handleReportSelection = (climaLabel) => {
    const climaId = climaLabel.toLowerCase();
    if (!userLocation) return;
    const MARGEN_DETECCION = 0.009;
    const reporteCercano = reportes.find((r) => {
      const dLat = r.coords.lat - userLocation.lat;
      const dLng = r.coords.lng - userLocation.lng;
      return Math.sqrt(dLat * dLat + dLng * dLng) < MARGEN_DETECCION;
    });

    if (reporteCercano) {
      setConfirmData({
        label: climaLabel,
        id: reporteCercano.id,
        tipoAnterior: reporteCercano.tipo,
        coordsAnteriores: reporteCercano.coords,
        sizeAnterior: reporteCercano.size
      });
      setIsModalOpen(false);
    } else {
      generarNuevaZona(climaId, userLocation);
      message.success(`Reporte de ${climaLabel} creado`);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <Spin size="large" />
        <p>Sincronizando con satélites...</p>
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
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap'
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

      <Modal open={isMenuOpen} onCancel={() => setIsMenuOpen(false)} footer={null} centered width={350} closable={false}>
        <UserProfileMenu userFromLogin={nombreUsuario} onCancel={() => setIsMenuOpen(false)} />
      </Modal>

      <Modal open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null} centered width={350} closable={false}>
        <ClimateMenu onSelect={handleReportSelection} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <Modal open={!!confirmData} onCancel={() => setConfirmData(null)} footer={null} centered width={320} closable={false}>
        {confirmData && (
          <ConfirmReport
            climaLabel={confirmData.label}
            onCancel={() => setConfirmData(null)}
            onConfirm={() => {
              const climaId = confirmData.label.toLowerCase();
              if (confirmData.tipoAnterior === climaId) {
                generarNuevaZona(climaId, confirmData.coordsAnteriores, confirmData.id, (confirmData.sizeAnterior || 250) + 150);
                message.success("¡Zona de clima expandida!");
              } else {
                generarNuevaZona(climaId, userLocation, confirmData.id, 250);
                message.warning("Clima actualizado en esta zona");
              }
            }}
          />
        )}
      </Modal>
    </Layout>
  );
}

export default MapPage;
