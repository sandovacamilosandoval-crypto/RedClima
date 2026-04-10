import React from "react";
import { Layout, Typography } from "antd";
// Según tu imagen, 'assets' está al lado de 'Header' dentro de 'components'
// Por eso usamos '../assets/icono.png' (sube un nivel)
import logoRedClima from "../assets/icono.png";
import "./Header.css";

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header = () => {
  return (
    <AntHeader className="header-container">
      <div className="header-content">
        {/* Usamos tu logo personalizado */}
        <img
          src={logoRedClima}
          alt="Logo RedClima"
          style={{
            height: "40px",
            width: "auto",
            marginRight: "-3px",
          }}
        />

        {/* Nombre blindado contra traducciones automáticas */}
        <Title level={1} className="header-title notranslate">
          RedClima
        </Title>
      </div>
    </AntHeader>
  );
};

export default Header;
