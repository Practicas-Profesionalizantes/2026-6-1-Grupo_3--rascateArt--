import { lazy, Suspense } from 'react'
import { Spin } from 'antd'
import { matchPath, useLocation } from './lib/router'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import CartDrawer from './components/CartDrawer'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import CheckoutPage from './pages/CheckoutPage'
import PaymentResultPage from './pages/PaymentResultPage'
import LoginPage from './pages/LoginPage'
import AccountPage from './pages/AccountPage'
import NotFoundPage from './pages/NotFoundPage'
import MercadoPagoDemoPage from './pages/MercadoPagoDemoPage'
import DemoBanner from './components/DemoBanner'
import { DEMO } from './lib/api'

const AdminPage = lazy(() => import('./pages/admin/AdminPage'))

const routes = [
  ['/', HomePage],
  ['/coleccion/:coleccion', HomePage],
  ['/producto/:id', ProductPage],
  ['/checkout', CheckoutPage],
  ['/pago/resultado', PaymentResultPage],
  ['/ingresar', LoginPage],
  ['/mi-cuenta', AccountPage],
  ...(DEMO ? [['/mercadopago/:id', MercadoPagoDemoPage]] : []),
]

const Loader = () => (
  <div className="page-loader">
    <Spin size="large" />
  </div>
)

export default function App() {
  const { pathname } = useLocation()

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return (
      <Suspense fallback={<Loader />}>
        {DEMO && <DemoBanner />}
        <AdminPage />
      </Suspense>
    )
  }

  let Page = NotFoundPage
  let params = {}
  for (const [pattern, Component] of routes) {
    const m = matchPath(pattern, pathname)
    if (m) {
      Page = Component
      params = m
      break
    }
  }

  return (
    <div className="site">
      {DEMO && <DemoBanner />}
      <SiteHeader />
      <main className="site-main">
        <Page params={params} key={pathname.startsWith('/coleccion') ? '/' : pathname} />
      </main>
      <SiteFooter />
      <CartDrawer />
    </div>
  )
}
