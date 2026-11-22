import React from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import './Landing.css';

// Datos del responsable del tratamiento: COMPLETAR antes de publicar
const RESPONSABLE = '[Nombre o razón social del responsable]';
const CORREO_CONTACTO = '[correo de contacto]';

export default function Privacidad() {
  const navigate = useNavigate();

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '640px', textAlign: 'left' }}>
        <h1 className="login-title">Política de Tratamiento de Datos Personales</h1>
        <div style={{ color: '#4a5568', maxHeight: '60vh', overflowY: 'auto', marginBottom: '20px', paddingRight: '10px', fontSize: '0.92rem', lineHeight: 1.55 }}>
          <p>
            En cumplimiento de la <strong>Ley 1581 de 2012</strong> y el <strong>Decreto 1377 de 2013</strong> de la
            República de Colombia, informamos cómo RedClima trata tus datos personales.
          </p>

          <p><strong>1. Responsable del tratamiento.</strong> {RESPONSABLE}. Contacto: {CORREO_CONTACTO} o el formulario
            de Soporte dentro de la aplicación.</p>

          <p><strong>2. Datos que recolectamos.</strong></p>
          <ul>
            <li>De tu cuenta de Google: correo electrónico e identificador de la cuenta.</li>
            <li>El nombre de usuario que eliges.</li>
            <li>Tu ubicación aproximada <em>solo en el momento en que haces un reporte</em>, junto con el clima reportado y la hora.</li>
            <li>Los mensajes que envías a Soporte y las denuncias de zonas, junto con datos técnicos (versión de la app,
              navegador, tamaño de pantalla) y tu zona aproximada (~100 m) para poder resolverlos.</li>
          </ul>

          <p><strong>3. Finalidad.</strong> Mostrar en el mapa el clima reportado por la comunidad, evitar reportes falsos o
            abusivos (moderación), llevar tu historial, nivel y XP, y responder tus solicitudes de soporte. No vendemos ni compartimos tus
            datos con fines publicitarios.</p>

          <p><strong>4. Qué ven los demás.</strong> Solo tu nombre de usuario. Tu correo y tu nombre real son privados.
            Los reportes se muestran <em>agrupados en zonas</em> con coordenadas redondeadas (~100 m), nunca tu ubicación
            exacta ni quién reportó.</p>

          <p><strong>4.1 Equipo de moderación.</strong> Para prevenir abusos, el equipo de RedClima puede ver tus reportes,
            tus mensajes de soporte y, solo los administradores, tu correo y tu zona habitual aproximada (~1 km). Puede
            advertir, suspender cuentas u ocultar reportes falsos. Toda acción de moderación queda registrada con su motivo
            y se te notifica en <em>Menú → Mis mensajes</em>.</p>

          <p><strong>5. Conservación.</strong> Los reportes dejan de mostrarse en el mapa 30 minutos después de creados.
            Se conservan en tu historial mientras tengas la cuenta.</p>

          <p><strong>6. Tus derechos.</strong> Puedes conocer, actualizar, rectificar y suprimir tus datos, revocar esta
            autorización y presentar quejas ante la Superintendencia de Industria y Comercio (SIC). Puedes borrar tu cuenta y
            todos tus datos en cualquier momento desde <em>Menú → Mi Perfil → Borrar mi cuenta y mis datos</em>.</p>

          <p><strong>7. Seguridad y almacenamiento.</strong> Los datos se almacenan en servidores de Supabase (región São
            Paulo, Brasil) con cifrado en tránsito y reglas de acceso por usuario. Al aceptar, autorizas esta transferencia
            internacional.</p>

          <p><strong>8. Autorización.</strong> Al marcar la casilla de aceptación e iniciar sesión, otorgas autorización
            previa, expresa e informada para el tratamiento descrito.</p>
        </div>
        <Button type="primary" className="btn-ver-clima" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/login"))}>Volver</Button>
      </div>
    </div>
  );
}
