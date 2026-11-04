import { useEffect } from 'react'
import { Button, Layout, Menu, Spin } from 'antd'
import EmptyState from '../../components/EmptyState'
import { DashboardOutlined, AppstoreOutlined, ShoppingOutlined, TeamOutlined, ShopOutlined, LogoutOutlined } from '@ant-design/icons'
import { Link, navigate, useLocation } from '../../lib/router'
import { useAuth } from '../../context/AuthContext'
import Dashboard from './Dashboard'
import ProductsAdmin from './ProductsAdmin'
import OrdersAdmin from './OrdersAdmin'
import UsersAdmin from './UsersAdmin'
import './admin.css'
import { LOGO } from '../../lib/api'

const SECTIONS = {
  '/admin': { label: 'Resumen', icon: <DashboardOutlined />, Component: Dashboard },
  '/admin/productos': { label: 'Productos', icon: <AppstoreOutlined />, Component: ProductsAdmin },
  '/admin/pedidos': { label: 'Pedidos', icon: <ShoppingOutlined />, Component: OrdersAdmin },
  '/admin/clientes': { label: 'Clientes', icon: <TeamOutlined />, Component: UsersAdmin },
}

export default function AdminPage() {
  const { user, ready, isAdmin, logout } = useAuth()
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '') || '/admin'
  const section = SECTIONS[path] || SECTIONS['/admin']

  useEffect(() => {
    if (ready && !user) navigate(`/ingresar?next=${encodeURIComponent(pathname)}`, { replace: true })
  }, [ready, user, pathname])

  useEffect(() => {
    document.title = `${section.label} · Admin Rascate Art`
    return () => {
      document.title = 'Rascate Art · Exclusividad y confort para tu gato'
    }
  }, [section.label])

  if (!ready || !user) {
    return (
      <div className="page-loader">
        <Spin size="large" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <EmptyState
        title="Esta sección es solo para administradores"
        text="Tu cuenta no tiene permisos de administración."
        action={<Button type="primary" onClick={() => navigate('/')}>Volver a la tienda</Button>}
      />
    )
  }

  const { Component } = section

  return (
    <Layout className="admin">
      <Layout.Sider breakpoint="lg" collapsedWidth={0} width={232} className="admin-sider">
        <Link to="/admin" className="admin-brand">
          <img src={LOGO} alt="" width="40" height="40" />
          <span>Rascate Admin</span>
        </Link>
        <Menu
          mode="inline"
          selectedKeys={[SECTIONS[path] ? path : '/admin']}
          onClick={({ key }) => navigate(key)}
          items={Object.entries(SECTIONS).map(([key, s]) => ({ key, icon: s.icon, label: s.label }))}
        />
        <div className="admin-sider-footer">
          <Button type="text" icon={<ShopOutlined />} block onClick={() => navigate('/')}>
            Ver tienda
          </Button>
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            block
            onClick={() => {
              logout()
              navigate('/')
            }}
          >
            Cerrar sesión
          </Button>
        </div>
      </Layout.Sider>
      <Layout>
        <Layout.Content className="admin-content">
          <div className="admin-topbar">
            <h1>{section.label}</h1>
            <span className="muted">{user.email}</span>
          </div>
          <Component />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
