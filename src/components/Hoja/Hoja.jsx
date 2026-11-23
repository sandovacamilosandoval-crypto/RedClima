import React from "react";
import { ArrowLeft, X } from "lucide";
import Icono from "../Icono";
import "./Hoja.css";

// Ventana estándar de la app: cabecera con ← o ✕ y título a la izquierda,
// contenido, y un pie opcional con la acción principal a todo el ancho.
export default function Hoja({ titulo, subtitulo, onAtras, onCerrar, pie, children, extraCabecera }) {
  return (
    <div className="hoja">
      <div className="hoja-cabecera">
        {onAtras && (
          <button type="button" className="hoja-icono" onClick={onAtras} aria-label="Volver">
            <Icono nodo={ArrowLeft} tamano={20} />
          </button>
        )}
        <div className="hoja-titulos">
          <h2 className="t-h2">{titulo}</h2>
          {subtitulo && <p className="t-sm">{subtitulo}</p>}
        </div>
        {extraCabecera}
        {onCerrar && (
          <button type="button" className="hoja-icono" onClick={onCerrar} aria-label="Cerrar">
            <Icono nodo={X} tamano={20} />
          </button>
        )}
      </div>
      <div className="hoja-cuerpo">{children}</div>
      {pie && <div className="hoja-pie">{pie}</div>}
    </div>
  );
}
