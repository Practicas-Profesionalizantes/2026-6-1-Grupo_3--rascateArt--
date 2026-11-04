import { Link } from '../lib/router'
import { LOGO } from '../lib/api'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <img src={LOGO} alt="" width="48" height="46" loading="lazy" />
          <div>
            <strong>Rascate Art</strong>
            <p>Exclusividad y confort para tu gato. Piezas hechas a mano.</p>
          </div>
        </div>
        <div className="footer-col">
          <h3>Tienda</h3>
          <ul>
            <li><Link to="/">Catálogo</Link></li>
            <li><Link to="/mi-cuenta">Mis pedidos</Link></li>
            <li><Link to="/checkout">Finalizar compra</Link></li>
          </ul>
        </div>
        <div className="footer-col">
          <h3>Pagos</h3>
          <ul>
            <li>Mercado Pago</li>
            <li>Tarjetas de crédito y débito</li>
            <li>Efectivo en Rapipago y Pago Fácil</li>
          </ul>
        </div>
      </div>
      <div className="container">
        <p className="footer-legal">© {new Date().getFullYear()} Rascate Art</p>
      </div>
    </footer>
  )
}
