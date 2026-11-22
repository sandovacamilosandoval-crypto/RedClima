import React, { useState, useEffect, useCallback, useRef } from "react";
import { App, Layout, Modal, Spin, Button, Input } from "antd";
import { MenuOutlined, CloseOutlined } from "@ant-design/icons";
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
  DURACION_REPORTE_MIN,
  distanciaMetros,
} from "../constants/clima";
import { infoNivel, XP_POR_REPORTE } from "../constants/niveles";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/errores";
import { contextoApp } from "../lib/contexto";
import { compartirRedClima } from "../lib/compartir";
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
  const { perfil, refrescarPerfil, noLeidas } = useAuth();
  const { message, modal } = App.useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false); // evita dobles envíos antes de que React re-renderice

  // Permiso de ubicación: primero explicamos para qué la usamos y luego la pedimos.
  // 'verificando' | 'explicar' | 'listo'
  const [permisoGps, setPermisoGps] = useState(() => (navigator.geolocation ? "verificando" : "listo"));
  const [ubicacion, setUbicacion] = useState(null);
  const [gpsError, setGpsError] = useState(() => (navigator.geolocation ? null : "sin-soporte"));
  const [intentoGps, setIntentoGps] = useState(0);
  const gpsEstado = ubicacion ? "ok" : gpsError ? "error" : "buscando";

  // Hasta cuándo está desbloqueado el mapa (vence con tu último reporte)
  const [reporteActivoHasta, setReporteActivoHasta] = useState(null);
  const [zonas, setZonas] = useState([]);
  const [actividad, setActividad] = useState(null); // para el estado vacío
  const [vacioCerrado, setVacioCerrado] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());

  // Denunciar una zona
  const [zonaDenuncia, setZonaDenuncia] = useState(null);
  const [textoDenuncia, setTextoDenuncia] = useState("");
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);

  const desbloqueado = reporteActivoHasta !== null && reporteActivoHasta > ahora;

  // ¿Ya dio permiso antes? Entonces no hace falta explicarle nada
  useEffect(() => {
    if (!navigator.geolocation) return;
    let activo = true;
    const decidir = (estado) => activo && setPermisoGps(estado);
    if (!navigator.permissions?.query) {
      Promise.resolve().then(() => decidir("explicar"));
    } else {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((s) => decidir(s.state === "prompt" ? "explicar" : "listo"))
        .catch(() => decidir("explicar"));
    }
    return () => {
      activo = false;
    };
  }, []);

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
    if (!navigator.geolocation || permisoGps !== "listo") return;
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
  }, [intentoGps, permisoGps]);

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

  // Zonas compartidas de toda la comunidad + actividad cercana (estado vacío)
  const lat = redondear(ubicacion?.lat);
  const lng = redondear(ubicacion?.lng);
  useEffect(() => {
    if (lat === undefined || !desbloqueado) return;
    let activo = true;
    const cargar = async () => {
      const [z, a] = await Promise.all([
        supabase.rpc("zonas_cercanas", { p_lat: lat, p_lng: lng, p_radio_m: RADIO_BUSQUEDA_M }),
        supabase.rpc("actividad_cercana", { p_lat: lat, p_lng: lng }),
      ]);
      if (!activo) return;
      if (!z.error) {
        setZonas(z.data ?? []);
        if (!a.error) setActividad(a.data);
      } else if (z.error.code === "P0001") {
        // El servidor dice que tu reporte ya venció (p. ej. reloj del celular adelantado)
        setReporteActivoHasta(null);
        setZonas([]);
      } else {
        message.error(mensajeError(z.error, "No pudimos cargar las zonas. Revisa tu conexión."));
      }
    };
    cargar();
    const id = setInterval(cargar, REFRESCO_ZONAS_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [lat, lng, desbloqueado, recarga, message]);

  const avisarSubidaDeNivel = (antes, despues) => {
    const a = infoNivel(antes).actual;
    const d = infoNivel(despues).actual;
    if (d.nivel > a.nivel) {
      modal.success({
        centered: true,
        title: `¡Subiste a nivel ${d.nivel}: ${d.nombre}!`,
        content: `${d.premio}. Gracias por mantener informada a tu comunidad.`,
        okText: "¡Genial!",
      });
    }
  };

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
      message.success({
        content: `¡Listo! Tu reporte de ${clima.label.toLowerCase()} ya está en el mapa durante ${DURACION_REPORTE_MIN} minutos. +${XP_POR_REPORTE} XP`,
        duration: 4,
      });
      // El XP se actualiza en segundo plano; si falla, no afecta al reporte
      const xpAntes = perfil?.xp ?? 0;
      refrescarPerfil()
        .then((nuevo) => nuevo && avisarSubidaDeNivel(xpAntes, nuevo.xp))
        .catch(() => {});
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

  const enviarDenuncia = async () => {
    if (enviandoDenuncia || !zonaDenuncia) return;
    const texto = textoDenuncia.trim();
    if (texto.length < 5) {
      message.warning("Cuéntanos qué ves realmente (mínimo 5 caracteres)");
      return;
    }
    setEnviandoDenuncia(true);
    const z = zonaDenuncia;
    const { error } = await supabase.rpc("crear_ticket", {
      p_categoria: "reporte_falso",
      p_mensaje: texto,
      p_contexto: contextoApp({
        zona_tipo: z.tipo,
        zona_reportes: z.reportes,
        zona_confianza: z.confianza,
        zona_actualizada: z.actualizado_en,
      }),
      p_lat: z.lat,
      p_lng: z.lng,
    });
    setEnviandoDenuncia(false);
    if (error) {
      message.error(mensajeError(error, "No pudimos enviar tu denuncia. Inténtalo de nuevo."));
      return;
    }
    setZonaDenuncia(null);
    setTextoDenuncia("");
    message.success("Gracias. Revisaremos esta zona. Puedes seguir el caso en Menú › Mis mensajes.");
  };

  const invitar = async () => {
    const r = await compartirRedClima();
    if (r === "copiado") message.success("Enlace copiado. ¡Compártelo con tus vecinos!");
    else if (r === "error") message.error("No pudimos compartir el enlace.");
  };

  if (permisoGps === "verificando") {
    return (
      <div className="loading-screen" role="status">
        <Spin size="large" />
      </div>
    );
  }

  // Explicación antes del aviso del navegador
  if (permisoGps === "explicar") {
    return (
      <div className="gps-explicacion">
        <div className="lock-card">
          <span className="lock-emoji" aria-hidden="true">📍</span>
          <h3>Necesitamos tu ubicación</h3>
          <p>Para mostrarte el clima de tu zona y que tu reporte aparezca donde estás.</p>
          <ul className="gps-explicacion-lista">
            <li>Solo la usamos mientras tienes RedClima abierto.</li>
            <li>Nadie ve tu ubicación exacta: el mapa la redondea a unos 100 m.</li>
            <li>Puedes quitar el permiso cuando quieras desde tu navegador.</li>
          </ul>
          <Button type="primary" size="large" className="btn-unlock" onClick={() => setPermisoGps("listo")}>
            Activar ubicación
          </Button>
        </div>
      </div>
    );
  }

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

  // Estado vacío: nadie más reportó cerca, o hay reportes pero aún no forman zonas visibles
  let vacio = null;
  if (desbloqueado && actividad && !vacioCerrado && gpsEstado === "ok") {
    if (actividad.otros_reportes === 0) {
      vacio = {
        titulo: "¡Estrena tu zona! 🌤️",
        texto: `Nadie más ha reportado cerca de ti en los últimos ${DURACION_REPORTE_MIN} minutos. Invita a tus vecinos para que tu zona tenga más datos.`,
        invitar: true,
      };
    } else if (zonas.length <= 1) {
      vacio = {
        titulo: "Tu zona está despertando",
        texto: `El reporte más cercano es de hace ${actividad.minutos_ultimo ?? 0} min, a ${actividad.km_mas_cercano} km. Las zonas aparecen cuando al menos 2 personas reportan en el mismo lugar.`,
        invitar: true,
      };
    }
  }

  return (
    <Layout className="map-layout">
      <Button
        className="btn-hamburguesa"
        shape="circle"
        icon={<MenuOutlined />}
        onClick={() => setIsMenuOpen(true)}
        aria-label={noLeidas > 0 ? `Abrir menú (${noLeidas} mensajes nuevos)` : "Abrir menú"}
      >
        {noLeidas > 0 && <span className="punto-notif" aria-hidden="true" />}
      </Button>

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
                <ZonaClima
                  key={`${z.lat},${z.lng},${i}`}
                  zona={z}
                  ahora={ahora}
                  onDenunciar={(zona) => setZonaDenuncia(zona)}
                />
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

          {vacio && (
            <div className="estado-vacio" role="status">
              <button
                type="button"
                className="estado-vacio-cerrar"
                onClick={() => setVacioCerrado(true)}
                aria-label="Cerrar aviso"
              >
                <CloseOutlined />
              </button>
              <strong>{vacio.titulo}</strong>
              <p>{vacio.texto}</p>
              {vacio.invitar && (
                <Button size="small" type="primary" onClick={invitar}>
                  Invitar vecinos
                </Button>
              )}
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
                    <span className="lock-emoji" aria-hidden="true">🌦️</span>
                    <h3>¿Cómo está el cielo ahí afuera?</h3>
                    <p>
                      Tu reporte tarda 3 segundos y ayuda a quien está por salir cerca de ti. Al reportar,
                      ves el mapa de tu zona durante <strong>{DURACION_REPORTE_MIN} minutos</strong>.
                    </p>
                    <Button type="primary" size="large" className="btn-unlock" onClick={() => setIsModalOpen(true)}>
                      Reportar el clima
                    </Button>
                    <p className="lock-nota">Cada reporte suma {XP_POR_REPORTE} XP para subir de nivel.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Content>

      {desbloqueado && <ReportButton onClick={() => setIsModalOpen(true)} />}

      <Modal open={isMenuOpen} onCancel={() => setIsMenuOpen(false)} footer={null} centered width={380} closable={false} destroyOnHidden>
        <UserProfileMenu onCancel={() => setIsMenuOpen(false)} ubicacion={ubicacion} />
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

      <Modal
        open={!!zonaDenuncia}
        onCancel={() => setZonaDenuncia(null)}
        centered
        width={360}
        title="¿Esta zona no muestra el clima real?"
        okText="Enviar denuncia"
        cancelText="Cancelar"
        confirmLoading={enviandoDenuncia}
        onOk={enviarDenuncia}
      >
        {zonaDenuncia && (
          <>
            <p className="denuncia-texto">
              La zona marca <strong>{CLIMA_POR_ID[zonaDenuncia.tipo]?.label}</strong>. Cuéntanos qué ves tú.
              Nuestro equipo la revisará y, si es falsa, la retirará del mapa.
            </p>
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              value={textoDenuncia}
              onChange={(e) => setTextoDenuncia(e.target.value)}
              placeholder="Ej.: Está lloviendo fuerte desde hace 20 minutos"
              aria-label="Qué ves realmente"
            />
            <p className="denuncia-nota">
              Si estás ahí, también puedes reportar el clima real: tu reporte ayuda a corregir la zona.
            </p>
          </>
        )}
      </Modal>
    </Layout>
  );
}

export default MapPage;
