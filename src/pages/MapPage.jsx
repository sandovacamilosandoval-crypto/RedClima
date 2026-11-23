import React, { useState, useEffect, useCallback, useRef } from "react";
import { App, Layout, Modal, Spin, Button, Input } from "antd";
import { MenuOutlined, CloseOutlined } from "@ant-design/icons";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, Star } from "lucide";
import ReportButton from "../components/ReportButton/ReportButton";
import ClimateMenu from "../components/ClimateMenu/ClimateMenu";
import ZonaClima from "../components/ZonaClima/ZonaClima";
import ConfirmReport from "../components/ConfirmReport/ConfirmReport";
import UserProfileMenu from "../components/UserProfileMenu";
import Buscador from "../components/Buscador/Buscador";
import Icono from "../components/Icono";
import IlustracionUbicacion from "../components/IlustracionUbicacion";
import {
  CLIMA_POR_ID,
  UBICACION_DEFECTO,
  RADIO_BUSQUEDA_M,
  REFRESCO_ZONAS_MS,
  TILES_URL,
  TILES_URL_RESPALDO,
  TILES_ATRIBUCION,
  MAPA_SUAVE,
  DURACION_REPORTE_MIN,
  distanciaMetros,
} from "../constants/clima";
import { infoNivel, XP_POR_REPORTE } from "../constants/niveles";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/errores";
import { contextoApp } from "../lib/contexto";
import { compartirRedClima } from "../lib/compartir";
import { obtenerPronostico } from "../lib/pronostico";
import { registrarPaso } from "../lib/embudo";
import { svgIcono } from "../lib/iconos";
import { useAuth } from "../context/AuthContext";
import "./MapPage.css";

const { Content } = Layout;

// Zoom de calle: ~ unas cuadras alrededor de tu punto
const ZOOM_CERCA = 17;

const OPCIONES_GPS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };

const TEXTO_ERROR_GPS = {
  1: "Bloqueaste el acceso a tu ubicación. Actívalo en los ajustes del navegador (en iPhone: Ajustes › Privacidad › Localización) y vuelve a intentarlo.",
  2: "No pudimos determinar tu ubicación. Activa el GPS o sal a un lugar con mejor señal.",
  3: "Tu ubicación tardó demasiado en llegar. Revisa que el GPS esté activo e inténtalo de nuevo.",
  "sin-soporte": "Tu navegador no permite obtener la ubicación. Prueba con otro navegador.",
};

// Lo que recordamos en este navegador para no repetir preguntas
const CLAVE_GPS_OK = "redclima:gps-aceptado";
const CLAVE_ULTIMA_POS = "redclima:ultima-posicion";
const CLAVE_TIP_IOS = "redclima:tip-ios-visto";
const leer = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const guardar = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // modo privado: solo se pierde la comodidad
  }
};
const esIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const esAndroid = () => /Android/i.test(navigator.userAgent);

// La base de datos solo acepta reportes con precisión de 500 m o mejor
const PRECISION_MAXIMA_M = 500;
// Desde este margen avisamos que el punto puede no ser exacto
const PRECISION_AVISO_M = 100;

function ComoActivarPrecision() {
  if (esIOS()) {
    return (
      <ol className="pasos-precision">
        <li>Abre <strong>Ajustes › Privacidad y seguridad › Localización</strong>.</li>
        <li>Entra en <strong>Safari</strong> (o el navegador que uses).</li>
        <li>Activa <strong>Ubicación exacta</strong> y vuelve aquí.</li>
        <li>Activa el <strong>Wi-Fi</strong> (aunque no te conectes): mejora mucho la precisión dentro de casa.</li>
      </ol>
    );
  }
  if (esAndroid()) {
    return (
      <ol className="pasos-precision">
        <li>Abre <strong>Ajustes › Ubicación</strong> y verifica que esté activada.</li>
        <li>Activa <strong>Precisión de la ubicación de Google</strong> (o "Usar ubicación precisa").</li>
        <li>Si el navegador pregunta, elige <strong>Precisa</strong> en vez de Aproximada.</li>
        <li>Activa el <strong>Wi-Fi</strong> (aunque no te conectes): mejora mucho la precisión dentro de casa.</li>
      </ol>
    );
  }
  return (
    <p className="pasos-precision-texto">
      Parece que estás en un computador: sin GPS, tu ubicación se calcula por internet y puede fallar por varios
      kilómetros. <strong>Reporta desde tu celular</strong> con el GPS activado; aquí puedes seguir buscando lugares y
      viendo el pronóstico.
    </p>
  );
}

const formatoDistancia = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`);

// Redondeo a ~1 km: las zonas solo se vuelven a pedir si el centro cambió de verdad
const redondear = (v) => Math.round(v * 100) / 100;

const ICONO_LUGAR = L.divIcon({
  className: "lugar-icono-wrapper",
  html: `<div class="lugar-icono">${svgIcono(MapPin, { tamano: 30, color: "#1d63d6", grosor: 2.2 })}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 28],
  popupAnchor: [0, -26],
});

const ICONO_YO = L.divIcon({ className: "yo-icono", iconSize: [16, 16], iconAnchor: [8, 8] });

// Mueve el mapa cuando se elige un destino (búsqueda, zona de interés, "mi ubicación")
// y avisa cuando el usuario termina de moverlo
function ControlMapa({ destino, onMover }) {
  const map = useMap();
  useEffect(() => {
    if (destino) map.flyTo([destino.lat, destino.lng], destino.zoom ?? 15, { duration: 0.8 });
  }, [destino, map]);
  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMover({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

function MapPage() {
  const { perfil, refrescarPerfil, refrescarNotificaciones, noLeidas } = useAuth();
  const { message, modal } = App.useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false); // evita dobles envíos antes de que React re-renderice

  // Permiso de ubicación: se explica una sola vez; luego se recuerda en este navegador
  const [permisoGps, setPermisoGps] = useState(() => {
    if (!navigator.geolocation) return "listo";
    return leer(CLAVE_GPS_OK) ? "listo" : "verificando";
  });
  const [ubicacion, setUbicacion] = useState(null);
  const [gpsError, setGpsError] = useState(() => (navigator.geolocation ? null : "sin-soporte"));
  const [intentoGps, setIntentoGps] = useState(0);
  const [tipIOS, setTipIOS] = useState(false);
  // Última posición conocida: permite mostrar el mapa mientras llega el GPS
  const [ultimaPos] = useState(() => {
    try {
      return JSON.parse(leer(CLAVE_ULTIMA_POS));
    } catch {
      return null;
    }
  });
  const gpsEstado = ubicacion ? "ok" : gpsError ? "error" : "buscando";
  // Ubicación aproximada (computador sin GPS, o celular sin "ubicación exacta")
  const precisionMala = !!ubicacion && ubicacion.precision > PRECISION_MAXIMA_M;
  // Margen visible: el teléfono no está seguro de dónde estás (aún se puede reportar)
  const precisionDudosa = !!ubicacion && ubicacion.precision > PRECISION_AVISO_M;
  const [avisoPrecision, setAvisoPrecision] = useState(false);

  // Lo que se está mirando: tu zona, un lugar buscado o donde moviste el mapa
  const [centro, setCentro] = useState(null);
  const [destino, setDestino] = useState(null);
  const [lugarBuscado, setLugarBuscado] = useState(null);
  const [pronostico, setPronostico] = useState(null);

  // Hasta cuándo está desbloqueado el mapa (vence con tu último reporte)
  const [reporteActivoHasta, setReporteActivoHasta] = useState(null);
  const [zonas, setZonas] = useState([]);
  const [actividad, setActividad] = useState(null);
  const [vacioCerrado, setVacioCerrado] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());

  // Denunciar una zona
  const [zonaDenuncia, setZonaDenuncia] = useState(null);
  const [textoDenuncia, setTextoDenuncia] = useState("");
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);

  const desbloqueado = reporteActivoHasta !== null && reporteActivoHasta > ahora;
  const avisosMostrados = useRef(new Set());

  // Mapa base: si el estilo principal no carga, usar el de respaldo
  const [urlMapa, setUrlMapa] = useState(TILES_URL);
  const erroresMapa = useRef(0);
  const alFallarTesela = useCallback(() => {
    erroresMapa.current += 1;
    if (erroresMapa.current >= 3 && TILES_URL_RESPALDO) setUrlMapa(TILES_URL_RESPALDO);
  }, []);

  // ¿Ya dio permiso antes? Entonces no hace falta explicarle nada
  useEffect(() => {
    if (permisoGps !== "verificando") return;
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
  }, [permisoGps]);

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
        const u = { lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy };
        setUbicacion(u);
        setGpsError(null);
        // recordar que ya aceptó, y la zona aproximada (~100 m) para la próxima visita
        if (!leer(CLAVE_GPS_OK)) {
          guardar(CLAVE_GPS_OK, "1");
          // En iPhone, Safari vuelve a preguntar en cada visita salvo que se permita en el sitio
          if (esIOS() && !leer(CLAVE_TIP_IOS)) setTipIOS(true);
        }
        guardar(CLAVE_ULTIMA_POS, JSON.stringify({ lat: +u.lat.toFixed(3), lng: +u.lng.toFixed(3) }));
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

  // El primer dato de GPS fija el centro y mueve el mapa a tu zona
  const primeraVez = useRef(true);
  useEffect(() => {
    if (ubicacion && primeraVez.current) {
      primeraVez.current = false;
      Promise.resolve().then(() => {
        setCentro({ lat: ubicacion.lat, lng: ubicacion.lng });
        setDestino({ lat: ubicacion.lat, lng: ubicacion.lng, zoom: ZOOM_CERCA });
      });
    }
  }, [ubicacion]);

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

  const cLat = centro ? redondear(centro.lat) : undefined;
  const cLng = centro ? redondear(centro.lng) : undefined;

  // Pronóstico de respaldo para lo que se está mirando (también con el mapa bloqueado)
  useEffect(() => {
    if (cLat === undefined) return;
    let activo = true;
    obtenerPronostico(cLat, cLng)
      .then((p) => activo && setPronostico(p))
      .catch(() => activo && setPronostico(null));
    return () => {
      activo = false;
    };
  }, [cLat, cLng]);

  // Zonas de la comunidad alrededor del centro + actividad (estado vacío)
  useEffect(() => {
    if (cLat === undefined || !desbloqueado) return;
    let activo = true;
    const cargar = async () => {
      const [z, a] = await Promise.all([
        supabase.rpc("zonas_hex", { p_lat: cLat, p_lng: cLng, p_radio_m: RADIO_BUSQUEDA_M }),
        supabase.rpc("actividad_cercana", { p_lat: cLat, p_lng: cLng }),
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
  }, [cLat, cLng, desbloqueado, recarga, message]);

  // Avisos de tus zonas de interés mientras tienes RedClima abierto
  useEffect(() => {
    let activo = true;
    const revisar = async () => {
      const { data } = await supabase
        .from("notificaciones")
        .select("id, titulo, creado_en")
        .eq("tipo", "zona_interes")
        .eq("leida", false)
        .order("creado_en", { ascending: false })
        .limit(3);
      if (!activo || !data) return;
      const nuevos = data.filter(
        (n) => !avisosMostrados.current.has(n.id) && Date.now() - new Date(n.creado_en).getTime() < 30 * 60 * 1000
      );
      nuevos.forEach((n) => {
        avisosMostrados.current.add(n.id);
        message.info({ content: `📍 ${n.titulo}`, duration: 6 });
      });
      if (nuevos.length) refrescarNotificaciones();
    };
    revisar();
    const id = setInterval(revisar, 60 * 1000);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [message, refrescarNotificaciones]);

  const alMover = useCallback((c) => {
    setCentro((prev) => (prev && redondear(prev.lat) === redondear(c.lat) && redondear(prev.lng) === redondear(c.lng) ? prev : c));
  }, []);

  const irA = useCallback((lugar) => {
    setDestino({ lat: lugar.lat, lng: lugar.lng, zoom: lugar.zoom ?? ZOOM_CERCA });
    setCentro({ lat: lugar.lat, lng: lugar.lng });
  }, []);

  const elegirLugar = (lugar) => {
    setLugarBuscado(lugar);
    irA({ ...lugar, zoom: ZOOM_CERCA - 1 });
  };

  const volverAMiUbicacion = () => {
    if (!ubicacion) {
      reintentarGps();
      return;
    }
    setLugarBuscado(null);
    irA({ lat: ubicacion.lat, lng: ubicacion.lng, zoom: ZOOM_CERCA });
  };

  const guardarLugarComoZona = async (lugar) => {
    const { error } = await supabase.rpc("guardar_zona_interes", {
      p_nombre: lugar.nombre.slice(0, 30),
      p_lat: lugar.lat,
      p_lng: lugar.lng,
    });
    if (error) {
      message.error(mensajeError(error, "No pudimos guardar la zona"));
      return;
    }
    message.success(`Guardada. Te avisaremos cuando alguien reporte el clima en ${lugar.nombre}.`);
  };

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
      if ((perfil?.total_reportes ?? 0) === 0) registrarPaso("primer_reporte");
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

  const abrirReporte = () => {
    if (precisionMala) {
      setAvisoPrecision(true);
      return;
    }
    setIsModalOpen(true);
  };

  const handleReportSelection = (clima) => {
    if (enviandoRef.current) return;
    if (!ubicacion) {
      message.error("Necesitamos tu ubicación para reportar.");
      return;
    }
    const zonaActual = zonas.find((z) => z.reciente !== false && distanciaMetros(z, ubicacion) <= z.radio_m);
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
    setRecarga((r) => r + 1);
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

  // Explicación antes del aviso del navegador (solo la primera vez)
  if (permisoGps === "explicar") {
    return (
      <main className="pantalla">
        <div className="tarjeta centrada">
          <IlustracionUbicacion />
          <div>
            <h1 className="t-titulo">Activa tu ubicación</h1>
            <p className="t-cuerpo" style={{ marginTop: 8 }}>
              Para ubicar tu reporte en el mapa. Nadie ve dónde estás exactamente.
            </p>
          </div>
          <Button type="primary" className="btn-principal" onClick={() => setPermisoGps("listo")}>
            Activar ubicación
          </Button>
          <p className="t-xs">Te lo pedimos una sola vez.</p>
        </div>
      </main>
    );
  }

  // Sin posición previa conocida, esperamos el GPS; con ella, mostramos el mapa ya
  if (gpsEstado === "buscando" && !ultimaPos) {
    return (
      <div className="loading-screen" role="status">
        <Spin size="large" />
        <p>Obteniendo tu ubicación...</p>
      </div>
    );
  }

  const inicio = ubicacion || ultimaPos || UBICACION_DEFECTO;
  const textoErrorGps = TEXTO_ERROR_GPS[gpsError] ?? TEXTO_ERROR_GPS[2];
  const mirandoOtroLugar = centro && ubicacion && distanciaMetros(centro, ubicacion) > 3000;
  const dondeMira = lugarBuscado && mirandoOtroLugar ? lugarBuscado.nombre : mirandoOtroLugar ? "esta zona" : "tu zona";

  // Estado vacío: nadie más reportó cerca, o hay reportes pero aún no forman zonas visibles
  let vacio = null;
  if (desbloqueado && actividad && !vacioCerrado && centro) {
    if (actividad.otros_reportes === 0 && zonas.length <= 1) {
      vacio = {
        titulo: mirandoOtroLugar ? "Aún nadie ha reportado por aquí" : "¡Estrena tu zona! 🌤️",
        texto: mirandoOtroLugar
          ? `No hay reportes recientes en ${dondeMira}. Te mostramos el pronóstico mientras tanto.`
          : `Nadie más ha reportado cerca de ti en los últimos ${DURACION_REPORTE_MIN} minutos. Invita a tus vecinos para que tu zona tenga más datos.`,
        invitar: !mirandoOtroLugar,
      };
    } else if (zonas.length === 0) {
      vacio = {
        titulo: "La zona está despertando",
        texto: `El reporte más cercano es de hace ${actividad.minutos_ultimo ?? 0} min, a ${actividad.km_mas_cercano} km. Las zonas aparecen cuando al menos 2 personas reportan en el mismo lugar.`,
        invitar: true,
      };
    }
  }

  const climaPronostico = pronostico ? CLIMA_POR_ID[pronostico.tipo] : null;

  return (
    <Layout className={`map-layout ${MAPA_SUAVE ? "mapa-suave" : ""}`}>
      {/* Barra superior: buscador + menú (por encima del candado) */}
      <div className="barra-superior">
        <Buscador cerca={ubicacion || ultimaPos} onElegir={elegirLugar} placeholder="Buscar barrio, lugar o ciudad…" />
        <Button
          className="btn-hamburguesa"
          shape="circle"
          icon={<MenuOutlined />}
          onClick={() => setIsMenuOpen(true)}
          aria-label={noLeidas > 0 ? `Abrir menú (${noLeidas} mensajes nuevos)` : "Abrir menú"}
        >
          {noLeidas > 0 && <span className="punto-notif" aria-hidden="true" />}
        </Button>
      </div>

      {/* Pronóstico de respaldo, siempre etiquetado como tal */}
      {climaPronostico && (
        <div className="chip-pronostico" role="status" aria-label="Pronóstico">
          <Icono nodo={climaPronostico.icono} tamano={18} color={climaPronostico.color} />
          <span>
            <strong>{pronostico.temperatura}°</strong> {climaPronostico.label}
            <small> · sensación {pronostico.sensacion}°</small>
          </span>
          <span className="chip-etiqueta">Pronóstico</span>
        </div>
      )}

      <Content className="main-content">
        <div className={`map-wrapper ${!desbloqueado ? "is-locked" : ""}`}>
          <MapContainer
            center={[inicio.lat, inicio.lng]}
            zoom={ZOOM_CERCA}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              key={urlMapa}
              url={urlMapa}
              maxZoom={19}
              attribution={TILES_ATRIBUCION}
              eventHandlers={{ tileerror: alFallarTesela }}
            />
            <ControlMapa destino={destino} onMover={alMover} />
            {ubicacion && (
              // Círculo de precisión: el teléfono te ubica en algún punto dentro de él
              <Circle
                center={[ubicacion.lat, ubicacion.lng]}
                radius={ubicacion.precision}
                interactive={false}
                pathOptions={{ color: "#2f6fde", weight: 1, opacity: 0.5, fillColor: "#4f8cff", fillOpacity: 0.12 }}
              />
            )}
            {ubicacion && <Marker position={[ubicacion.lat, ubicacion.lng]} icon={ICONO_YO} alt="Tu ubicación" interactive={false} />}
            {desbloqueado &&
              zonas.map((z, i) => (
                <ZonaClima
                  key={`${z.lat},${z.lng},${i}`}
                  zona={z}
                  ahora={ahora}
                  onDenunciar={(zona) => setZonaDenuncia(zona)}
                />
              ))}
            {lugarBuscado && (
              <Marker position={[lugarBuscado.lat, lugarBuscado.lng]} icon={ICONO_LUGAR} alt={lugarBuscado.nombre}>
                <Popup>
                  <div className="lugar-popup">
                    <strong>{lugarBuscado.nombre}</strong>
                    {lugarBuscado.detalle && <small>{lugarBuscado.detalle}</small>}
                    <button type="button" onClick={() => guardarLugarComoZona(lugarBuscado)}>
                      <Icono nodo={Star} tamano={14} color="#b45309" /> Guardar como zona de interés
                    </button>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          <button type="button" className="btn-mapa btn-mi-ubicacion" onClick={volverAMiUbicacion} aria-label="Ir a mi ubicación">
            <Icono nodo={LocateFixed} tamano={20} color="#1d63d6" />
          </button>

          {desbloqueado && precisionDudosa && (
            <button type="button" className="chip-precision" onClick={() => setAvisoPrecision(true)}>
              Ubicación imprecisa: ±{formatoDistancia(ubicacion.precision)} · ¿Cómo mejorarla?
            </button>
          )}

          {gpsEstado === "buscando" && (
            <div className="chip-ubicando" role="status">
              <Spin size="small" /> Ubicándote…
            </div>
          )}

          {tipIOS && (
            <div className="gps-aviso" role="status">
              <span>
                Para que tu iPhone no te pregunte la ubicación en cada visita: toca <strong>aA</strong> en la barra de
                Safari › <strong>Configuración del sitio web</strong> › Ubicación › <strong>Permitir</strong>.
              </span>
              <Button
                size="small"
                onClick={() => {
                  guardar(CLAVE_TIP_IOS, "1");
                  setTipIOS(false);
                }}
              >
                Entendido
              </Button>
            </div>
          )}

          {/* Mapa desbloqueado pero sin GPS: avisar en vez de mostrar un mapa vacío */}
          {desbloqueado && gpsEstado === "error" && !tipIOS && (
            <div className="gps-aviso" role="alert">
              <span>{textoErrorGps}</span>
              <Button size="small" type="primary" onClick={reintentarGps}>
                Reintentar
              </Button>
            </div>
          )}

          {vacio && !tipIOS && (
            <div className="estado-vacio" role="status">
              <button type="button" className="estado-vacio-cerrar" onClick={() => setVacioCerrado(true)} aria-label="Cerrar aviso">
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
                    <h2 className="t-h2">Activa tu ubicación</h2>
                    <p className="t-sm">{textoErrorGps}</p>
                    <Button type="primary" className="btn-principal" onClick={reintentarGps}>
                      Reintentar
                    </Button>
                  </>
                ) : (
                  <>
                    <h2 className="t-h2">Reporta para ver el mapa</h2>
                    <p className="t-sm">
                      {lugarBuscado && mirandoOtroLugar
                        ? `Dinos qué clima ves donde estás y mira ${lugarBuscado.nombre} durante ${DURACION_REPORTE_MIN} min.`
                        : `Dinos qué clima ves y desbloquea el mapa durante ${DURACION_REPORTE_MIN} min.`}
                    </p>
                    <Button
                      type="primary"
                      className="btn-principal"
                      onClick={abrirReporte}
                      disabled={gpsEstado !== "ok"}
                    >
                      {gpsEstado === "ok" ? "Reportar el clima" : "Ubicándote…"}
                    </Button>
                    {precisionMala && (
                      <p className="lock-aviso-precision" role="status">
                        Tu ubicación es aproximada (±{formatoDistancia(ubicacion.precision)}).{" "}
                        <button type="button" onClick={() => setAvisoPrecision(true)}>
                          ¿Cómo lo arreglo?
                        </button>
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Content>

      {desbloqueado && <ReportButton onClick={abrirReporte} />}

      <Modal open={isMenuOpen} onCancel={() => setIsMenuOpen(false)} footer={null} centered width={380} closable={false} destroyOnHidden>
        <UserProfileMenu
          onCancel={() => setIsMenuOpen(false)}
          ubicacion={ubicacion}
          onIrA={(z) => {
            setIsMenuOpen(false);
            setLugarBuscado({ nombre: z.nombre, lat: z.lat, lng: z.lng });
            irA({ lat: z.lat, lng: z.lng, zoom: ZOOM_CERCA - 1 });
          }}
        />
      </Modal>

      <Modal open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null} centered width={380} closable={false}>
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
        open={avisoPrecision}
        onCancel={() => setAvisoPrecision(false)}
        centered
        width={380}
        title={precisionMala ? "Tu ubicación es aproximada" : "Tu ubicación puede estar corrida"}
        footer={[
          <Button key="cerrar" onClick={() => setAvisoPrecision(false)}>
            Entendido
          </Button>,
          <Button
            key="reintentar"
            type="primary"
            onClick={() => {
              setAvisoPrecision(false);
              reintentarGps();
            }}
          >
            Ya lo activé, reintentar
          </Button>,
        ]}
      >
        <p className="denuncia-texto">
          Tu teléfono te ubica con un margen de{" "}
          <strong>{ubicacion ? formatoDistancia(ubicacion.precision) : "varios kilómetros"}</strong>: el punto azul puede no
          estar exactamente donde estás.{" "}
          {precisionMala
            ? "Para reportar necesitamos 500 m o menos."
            : "Puedes reportar, pero con un margen menor tu reporte cae en la zona correcta."}
        </p>
        <ComoActivarPrecision />
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
              La zona marca <strong>{CLIMA_POR_ID[zonaDenuncia.tipo]?.label}</strong>. Cuéntanos qué ves tú. Si 3 vecinos
              coinciden, la retiramos del mapa de inmediato.
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
