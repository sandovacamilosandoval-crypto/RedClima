import React, { useState } from "react";
import { App, Button, Input } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { supabase } from "../../lib/supabase";
import { mensajeError } from "../../lib/errores";
import { contextoApp } from "../../lib/contexto";
import { CATEGORIAS, CATEGORIA_POR_ID } from "./categorias";
import "./Soporte.css";

// Formulario de "Ayuda, quejas o sugerencias": crea un caso para el equipo
export default function SoporteForm({ ubicacion, onVolver, onEnviado }) {
  const { message } = App.useApp();
  const [categoria, setCategoria] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (enviando) return;
    if (!categoria) {
      message.warning("Elige un motivo");
      return;
    }
    if (mensaje.trim().length < 5) {
      message.warning("Escribe al menos 5 caracteres");
      return;
    }
    setEnviando(true);
    const { data, error } = await supabase.rpc("crear_ticket", {
      p_categoria: categoria,
      p_mensaje: mensaje.trim(),
      p_contexto: contextoApp(),
      p_lat: ubicacion?.lat ?? null,
      p_lng: ubicacion?.lng ?? null,
    });
    setEnviando(false);
    if (error) {
      message.error(mensajeError(error, "No pudimos enviar tu mensaje. Inténtalo de nuevo."));
      return;
    }
    message.success({
      content: "¡Recibido! Te responderemos en menos de 24 horas en Mis mensajes.",
      duration: 5,
    });
    onEnviado?.(data);
  };

  return (
    <div className="menu-subview-container">
      <h2 className="subview-title centered">¿En qué te ayudamos?</h2>

      <div className="soporte-categorias" role="radiogroup" aria-label="Motivo">
        {CATEGORIAS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={categoria === c.value}
            className={`soporte-categoria ${categoria === c.value ? "activa" : ""}`}
            onClick={() => setCategoria(c.value)}
          >
            <span aria-hidden="true">{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      <Input.TextArea
        aria-label="Tu mensaje"
        rows={4}
        maxLength={2000}
        showCount
        placeholder={categoria ? CATEGORIA_POR_ID[categoria].ayuda : "Primero elige un motivo"}
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        style={{ marginTop: 14, borderRadius: 12 }}
      />
      <p className="soporte-nota">
        Adjuntamos automáticamente la versión de la app y tu zona aproximada para resolverlo más rápido.
      </p>

      <div className="dual-buttons-container">
        <Button icon={<ArrowLeftOutlined />} className="btn-volver-rojo" onClick={onVolver}>
          Volver
        </Button>
        <Button type="primary" className="btn-action-azul" loading={enviando} onClick={enviar}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
