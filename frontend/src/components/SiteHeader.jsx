import { useState } from 'react'
import { Button, Drawer, Dropdown, Tooltip } from 'antd'
import { MenuOutlined, UserOutlined } from '@ant-design/icons'
import { Link, navigate, useLocation } from '../lib/router'
import { LOGO } from '../lib/api'
import { useShop } from '../context/ShopContext'
import { useAuth } from '../context/AuthContext'

export default function SiteHeader() {
  const { count, setCartOpen, config } = useShop()
  const { user, isAdmin, logout } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const current = decodeURIComponent(pathname)

  const colecciones = config.colecciones.length ? config.colecciones : ['Juguetes', 'Premium', 'Rascadores']
  const links = [
    { to: '/', label: 'Tienda' },
    ...colecciones.map((c) => ({ to: `/coleccion/${encodeURIComponent(c)}`, label: c, match: `/coleccion/${c}` })),
  ]

  const userMenu = {
    items: [
      { key: 'cuenta', label: 'Ver mis pedidos' },
      ...(isAdmin ? [{ key: 'admin', label: 'Abrir panel de administración' }] : []),
      { type: 'divider' },
      { key: 'salir', label: 'Cerrar sesión', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'cuenta') navigate('/mi-cuenta')
      if (key === 'admin') navigate('/admin')
      if (key === 'salir') {
        logout()
        navigate('/')
      }
    },
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Tooltip title="Abrir menú">
          <Button
            type="text"
            className="menu-toggle"
            icon={<MenuOutlined />}
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          />
        </Tooltip>

        <Link to="/" className="brand" aria-label="Rascate Art, inicio">
          <img src={LOGO} alt="" width="44" height="42" />
          <span>Rascate Art</span>
        </Link>

        <nav className="main-nav" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={current === (l.match || l.to) ? 'active' : ''}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          {user ? (
            <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
              <Button type="text" icon={<UserOutlined />} aria-label="Mi cuenta">
                <span className="hide-sm">{user.nombre.split(' ')[0]}</span>
              </Button>
            </Dropdown>
          ) : (
            <Button type="text" icon={<UserOutlined />} onClick={() => navigate('/ingresar')} aria-label="Ingresar">
              <span className="hide-sm">Ingresar</span>
            </Button>
          )}
          <Button type="primary" onClick={() => setCartOpen(true)} aria-label={`Abrir carrito, ${count} productos`}>
            Carrito
            {count > 0 && <span className="cart-count">{count}</span>}
          </Button>
        </div>
      </div>

      <Drawer title="Menú" placement="left" open={menuOpen} onClose={() => setMenuOpen(false)} size={300}>
        <nav className="mobile-nav" aria-label="Principal">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={current === (l.match || l.to) ? 'active' : ''} onClick={() => setMenuOpen(false)}>
              {l.label}
            </Link>
          ))}
          <Link to={user ? '/mi-cuenta' : '/ingresar'} onClick={() => setMenuOpen(false)}>
            {user ? 'Mis pedidos' : 'Ingresar o crear cuenta'}
          </Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setMenuOpen(false)}>
              Panel de administración
            </Link>
          )}
        </nav>
      </Drawer>
    </header>
  )
}
