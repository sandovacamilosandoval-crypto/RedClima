import React from "react";
import { svgIcono } from "../lib/iconos";

// Icono de línea. `nodo` viene de lucide (datos estáticos del proyecto).
export default function Icono({ nodo, tamano = 24, color = "currentColor", grosor = 2, className = "" }) {
  return (
    <span
      className={`icono ${className}`}
      style={{ display: "inline-flex", lineHeight: 0 }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgIcono(nodo, { tamano, color, grosor }) }}
    />
  );
}
