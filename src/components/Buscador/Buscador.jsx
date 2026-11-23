import React, { useEffect, useId, useRef, useState } from "react";
import { Search, MapPin, X } from "lucide";
import Icono from "../Icono";
import { buscarLugares } from "../../lib/geocoder";
import "./Buscador.css";

// Buscador de lugares con sugerencias (accesible con teclado)
export default function Buscador({ cerca, onElegir, placeholder = "Buscar un lugar…", autoFocus = false, compacto = false }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState([]);
  const [estado, setEstado] = useState("inactivo"); // inactivo | buscando | listo | error
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const id = useId();
  const contenedor = useRef(null);
  const cercaRef = useRef(cerca);
  useEffect(() => {
    cercaRef.current = cerca;
  }, [cerca]);

  // Sugerencias mientras escribe (espera 350 ms y cancela la búsqueda anterior)
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setEstado("buscando");
      buscarLugares(q, cercaRef.current, ctrl.signal)
        .then((r) => {
          setResultados(r);
          setEstado("listo");
          setActivo(-1);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setEstado("error");
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [texto]);

  // Cerrar al tocar fuera
  useEffect(() => {
    const fuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, []);

  const elegir = (lugar) => {
    setTexto(lugar.nombre);
    setAbierto(false);
    onElegir(lugar);
  };

  const alTeclear = (e) => {
    if (!abierto || resultados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => (a + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => (a <= 0 ? resultados.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      elegir(resultados[activo >= 0 ? activo : 0]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const corto = texto.trim().length < 3;
  const mostrarLista = abierto && !corto;

  return (
    <div className={`buscador ${compacto ? "compacto" : ""}`} ref={contenedor}>
      <div className="buscador-caja">
        <Icono nodo={Search} tamano={18} color="#596579" />
        <input
          type="search"
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={`${id}-lista`}
          aria-activedescendant={activo >= 0 ? `${id}-op-${activo}` : undefined}
          aria-autocomplete="list"
          aria-label="Buscar un lugar"
          placeholder={placeholder}
          value={texto}
          autoFocus={autoFocus}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclear}
          enterKeyHint="search"
        />
        {texto && (
          <button
            type="button"
            className="buscador-limpiar"
            aria-label="Borrar búsqueda"
            onClick={() => {
              setTexto("");
              setResultados([]);
            }}
          >
            <Icono nodo={X} tamano={16} color="#596579" />
          </button>
        )}
      </div>
      {mostrarLista && (
        <ul className="buscador-lista" role="listbox" id={`${id}-lista`}>
          {estado === "buscando" && resultados.length === 0 && <li className="buscador-info">Buscando…</li>}
          {estado === "error" && <li className="buscador-info">No pudimos buscar. Revisa tu conexión.</li>}
          {estado === "listo" && resultados.length === 0 && <li className="buscador-info">No encontramos ese lugar.</li>}
          {resultados.map((r, i) => (
            <li
              key={r.id}
              id={`${id}-op-${i}`}
              role="option"
              aria-selected={i === activo}
              className={`buscador-op ${i === activo ? "activa" : ""}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => elegir(r)}
            >
              <Icono nodo={MapPin} tamano={16} color="#1d63d6" />
              <span>
                <strong>{r.nombre}</strong>
                {r.detalle && <small>{r.detalle}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
