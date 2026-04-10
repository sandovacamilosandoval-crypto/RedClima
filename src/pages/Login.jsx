import React, { useState } from "react";
import { Button, Checkbox, message } from "antd";
import { useNavigate } from "react-router-dom";
import logo from "../components/assets/icono.png";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleGoogleLogin = () => {
    if (!accepted) {
      message.warning("Debes aceptar los términos y condiciones");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      navigate("/registro");
    }, 2000);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src={logo} alt="RedClima Logo" className="login-logo-small" />
          <h1 className="login-brand">RedClima</h1>
        </div>

        <p className="login-subtitle">
          Únete a la red para ver y reportar el clima en tiempo real.
        </p>

        <h2 className="login-title">Inicia Sesión</h2>

        <Button
          className="btn-google"
          loading={loading}
          disabled={!accepted || loading}
          icon={
            !loading && (
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                style={{ width: "18px", height: "18px" }}
              />
            )
          }
          onClick={handleGoogleLogin}
        >
          {loading ? "Verificando..." : "Continuar con Google"}
        </Button>

        <div className="login-terms-wrapper">
          <Checkbox
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="login-checkbox"
          >
            Acepto los{" "}
            <span
              className="link-text"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/terminos");
              }}
            >
              Términos
            </span>{" "}
            y la{" "}
            <span
              className="link-text"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/privacidad");
              }}
            >
              Privacidad
            </span>
            .
          </Checkbox>
        </div>
      </div>
    </div>
  );
}
