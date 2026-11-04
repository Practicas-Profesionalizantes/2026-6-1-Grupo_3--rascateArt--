import { Button, Drawer } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { navigate } from '../lib/router'
import { formatMoney } from '../lib/format'
import { useShop } from '../context/ShopContext'
import ProductImage from './ProductImage'
import QuantityInput from './QuantityInput'
import EmptyState from './EmptyState'

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQuantity, removeFromCart, subtotal, config } = useShop()

  const goCheckout = () => {
    setCartOpen(false)
    navigate('/checkout')
  }

  const falta = config.freeShippingFrom > 0 && subtotal < config.freeShippingFrom ? config.freeShippingFrom - subtotal : 0

  return (
    <Drawer
      title="Tu carrito"
      placement="right"
      open={cartOpen}
      onClose={() => setCartOpen(false)}
      size={420}
      footer={
        cart.length > 0 && (
          <div className="cart-footer">
            {config.shippingCost > 0 && config.freeShippingFrom > 0 && (
              <p className="muted small">
                {falta > 0 ? `Sumá ${formatMoney(falta)} más para tener envío gratis.` : 'Tu pedido tiene envío gratis.'}
              </p>
            )}
            <div className="cart-total">
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            <Button type="primary" size="large" block onClick={goCheckout}>
              Finalizar compra
            </Button>
            <Button type="text" block onClick={() => setCartOpen(false)}>
              Seguir comprando
            </Button>
          </div>
        )
      }
    >
      {cart.length === 0 ? (
        <EmptyState
          title="Tu carrito está vacío"
          text="Elegí un rascador o un juguete y aparece acá."
          action={
            <Button type="primary" onClick={() => setCartOpen(false)}>
              Ver productos
            </Button>
          }
        />
      ) : (
        <ul className="cart-list">
          {cart.map((item) => (
            <li key={item.id} className="cart-item">
              <ProductImage src={item.imagen} alt="" className="thumb cart-thumb" />
              <div className="cart-item-info">
                <span className="cart-item-name">{item.nombre}</span>
                <span className="muted small">{formatMoney(item.precioFinal)} c/u</span>
                <div className="cart-item-actions">
                  <QuantityInput size="small" value={item.cantidad} max={item.stock ?? 99} onChange={(n) => setQuantity(item.id, n)} />
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Quitar ${item.nombre}`}
                    title="Quitar del carrito"
                  />
                </div>
              </div>
              <strong className="cart-item-total">{formatMoney(item.precioFinal * item.cantidad)}</strong>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
