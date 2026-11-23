import React, { useState } from "react";
import { App, Button, Input } from "antd";
import { supabase } from "../../lib/supabase";
import { mensajeError } from "../../lib/errores";
import { contextoApp } from "../../lib/contexto";
import { CATEGORIAS, CATEGORIA_POR_ID } from "./categorias";
import Hoja from "../Hoja/Hoja";
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
    <Hoja
      titulo="Nueva consulta"
      subtitulo="Te responde el administrador en Soporte, normalmente en menos de 24 horas."
      onAtras={onVolver}
      pie={
        <Button type="primary" className="btn-principal" loading={enviando} onClick={enviar}>
          Enviar
        </Button>
      }
    >
      <div className="campo">
        <span className="campo-etiqueta" id="soporte-motivo">Motivo</span>
        <div className="soporte-categorias" role="radiogroup" aria-labelledby="soporte-motivo">
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
      </div>

      <div className="campo">
        <label className="campo-etiqueta" htmlFor="soporte-mensaje">Mensaje</label>
        <Input.TextArea
          id="soporte-mensaje"
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={2000}
          placeholder={categoria ? CATEGORIA_POR_ID[categoria].ayuda : "Primero elige un motivo"}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        />
        <p className="campo-ayuda">Adjuntamos la versión de la app y tu zona aproximada para resolverlo más rápido.</p>
      </div>
    </Hoja>
  );
}
