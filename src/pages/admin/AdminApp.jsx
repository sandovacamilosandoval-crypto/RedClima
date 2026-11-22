import React, { useMemo, useState } from "react";
import { Button, Drawer, Grid, Layout, Menu } from "antd";
import {
  AlertOutlined,
  ArrowLeftOutlined,
  AuditOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  MenuOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Resumen from "./Resumen";
import Soporte from "./Soporte";
import Reportes from "./Reportes";
import Usuarios from "./Usuarios";
import Calidad from "./Calidad";
import Auditoria from "./Auditoria";
import UsuarioDrawer from "./UsuarioDrawer";
import { AdminContext } from "./comun";
import "./admin.css";

const { Sider, Header, Content } = Layout;

// Panel del equipo. La seguridad real está en la base de datos (RLS + funciones):
// esta interfaz solo muestra lo que Supabase permite a moderadores y admins.
export default function AdminApp() {
  const { rol, perfil } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pantallas = Grid.useBreakpoint();
  const movil = !pantallas.lg;
  const [menuMovil, setMenuMovil] = useState(false);
  const [usuarioAbierto, setUsuarioAbierto] = useState(null);

  const items = [
    { key: "/admin", icon: <DashboardOutlined />, label: "Resumen" },
    { key: "/admin/soporte", icon: <CustomerServiceOutlined />, label: "Soporte" },
    { key: "/admin/reportes", icon: <EnvironmentOutlined />, label: "Reportes" },
    { key: "/admin/usuarios", icon: <TeamOutlined />, label: "Usuarios" },
    { key: "/admin/calidad", icon: <AlertOutlined />, label: "Calidad del dato" },
    ...(rol === "admin" ? [{ key: "/admin/auditoria", icon: <AuditOutlined />, label: "Auditoría" }] : []),
  ];
  const seleccionado = items
    .map((i) => i.key)
    .filter((k) => location.pathname === k || location.pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0] ?? "/admin";

  const ctx = useMemo(() => ({ abrirUsuario: (id) => setUsuarioAbierto(id) }), []);

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[seleccionado]}
      items={items}
      onClick={({ key }) => {
        navigate(key);
        setMenuMovil(false);
      }}
      style={{ borderInlineEnd: 0 }}
    />
  );

  return (
    <AdminContext.Provider value={ctx}>
      <Layout className="admin-layout">
        {!movil && (
          <Sider width={220} theme="light" className="admin-sider">
            <div className="admin-marca">RedClima · Equipo</div>
            {menu}
          </Sider>
        )}
        <Layout>
          <Header className="admin-header">
            {movil && (
              <Button icon={<MenuOutlined />} aria-label="Abrir menú del panel" onClick={() => setMenuMovil(true)} />
            )}
            <span className="admin-quien">
              @{perfil?.username} · {rol === "admin" ? "Administrador" : "Moderador"}
            </span>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/mapa")}>
              Volver al mapa
            </Button>
          </Header>
          <Content className="admin-content">
            <Routes>
              <Route index element={<Resumen />} />
              <Route path="soporte" element={<Soporte />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="calidad" element={<Calidad />} />
              {rol === "admin" && <Route path="auditoria" element={<Auditoria />} />}
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>

      <Drawer open={menuMovil} onClose={() => setMenuMovil(false)} placement="left" size={260} title="RedClima · Equipo">
        {menu}
      </Drawer>
      <UsuarioDrawer usuarioId={usuarioAbierto} onClose={() => setUsuarioAbierto(null)} />
    </AdminContext.Provider>
  );
}
