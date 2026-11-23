import React, { useEffect, useState } from "react";
import { Input } from "antd";
import { supabase } from "../lib/supabase";
import { USERNAME_CHARS, normalizarUsername, esUsernameValido } from "../constants/clima";

// Nombre de usuario con "@" fijo y comprobación en vivo de que no esté repetido.
// onEstado({ valor, valido, disponible }) — disponible: true | false | null (comprobando)
export default function CampoUsuario({ valor, onCambio, actual = null, onEnter, onEstado, id = "campo-usuario", autoFocus }) {
  const [disp, setDisp] = useState({ para: null, ok: null });
  const valido = esUsernameValido(valor);
  const esElActual = actual !== null && valor === actual;

  // Consultar a la base de datos 400 ms después de dejar de escribir
  useEffect(() => {
    if (!valido || esElActual) return;
    let activo = true;
    const t = setTimeout(() => {
      supabase.rpc("username_disponible", { p_username: valor }).then(({ data, error }) => {
        if (activo) setDisp({ para: valor, ok: error ? null : data });
      });
    }, 400);
    return () => {
      activo = false;
      clearTimeout(t);
    };
  }, [valor, valido, esElActual]);

  const disponible = esElActual ? true : disp.para === valor ? disp.ok : null;

  useEffect(() => {
    onEstado?.({ valor, valido, disponible });
  }, [valor, valido, disponible, onEstado]);

  let ayuda = { texto: "De 3 a 20 caracteres: letras, números, punto, guion o guion bajo.", clase: "" };
  if (valor && !valido) ayuda = { texto: "Usa de 3 a 20 caracteres: letras, números, punto, guion o guion bajo.", clase: "error" };
  else if (valido && esElActual) ayuda = { texto: "Este es tu nombre actual.", clase: "" };
  else if (valido && disponible === null) ayuda = { texto: "Comprobando si está disponible…", clase: "" };
  else if (valido && disponible === false) ayuda = { texto: `@${valor} ya está en uso. Prueba con otro.`, clase: "error" };
  else if (valido && disponible) ayuda = { texto: `@${valor} está disponible.`, clase: "ok" };

  return (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor={id}>Nombre de usuario</label>
      <Input
        id={id}
        size="large"
        prefix={<span className="campo-arroba" aria-hidden="true">@</span>}
        placeholder="tunombre"
        value={valor}
        maxLength={20}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={`${id}-ayuda`}
        status={ayuda.clase === "error" ? "error" : ""}
        onChange={(e) => {
          const v = normalizarUsername(e.target.value.replace(/^@+/, ""));
          if (USERNAME_CHARS.test(v)) onCambio(v);
        }}
        onPressEnter={onEnter}
      />
      <p id={`${id}-ayuda`} className={`campo-ayuda ${ayuda.clase}`} aria-live="polite">{ayuda.texto}</p>
    </div>
  );
}
