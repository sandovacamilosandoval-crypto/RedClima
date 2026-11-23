import React from "react";

// Ilustración: círculo con un pedazo de mapa y el pin encima
export default function IlustracionUbicacion() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" className="ilustracion-ubicacion">
      <defs>
        <clipPath id="circulo-mapa">
          <circle cx="48" cy="48" r="44" />
        </clipPath>
      </defs>
      <circle cx="48" cy="48" r="46" fill="#eaf2ff" stroke="#cfe0fb" strokeWidth="2" />
      <g clipPath="url(#circulo-mapa)" stroke="#ffffff" strokeLinecap="round">
        <path d="M-4 62 C 20 54, 34 70, 60 58 S 92 44, 104 50" strokeWidth="7" />
        <path d="M30 -4 L 40 104" strokeWidth="5" />
        <path d="M-4 30 L 104 22" strokeWidth="4" />
        <path d="M70 -4 L 64 104" strokeWidth="4" />
      </g>
      <rect x="10" y="68" width="18" height="12" rx="3" fill="#cde6d3" clipPath="url(#circulo-mapa)" />
      <rect x="72" y="28" width="14" height="16" rx="3" fill="#cde6d3" />
      <path d="M48 70c0 0-15-14.5-15-26a15 15 0 0 1 30 0c0 11.5-15 26-15 26z" fill="#2f6fde" />
      <circle cx="48" cy="44" r="5.5" fill="#ffffff" />
      <ellipse cx="48" cy="73" rx="7" ry="2" fill="#2f6fde" opacity="0.25" />
    </svg>
  );
}
