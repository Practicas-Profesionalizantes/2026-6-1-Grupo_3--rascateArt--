import { Button } from 'antd'
import { Link } from '../lib/router'
import { formatMoney } from '../lib/format'
import { useShop } from '../context/ShopContext'
import ProductImage from './ProductImage'

export default function ProductCard({ product }) {
  const { addToCart } = useShop()
  const agotado = product.stock === 0
  const to = `/producto/${product.id}`

  return (
    <article className="product-card">
      <Link to={to} className="product-card-media" tabIndex={-1} aria-hidden="true">
        <ProductImage src={product.imagen} alt="" />
        {product.descuento > 0 && <span className="tag-sale">-{product.descuento}%</span>}
        {agotado && <span className="tag-out">Sin stock</span>}
      </Link>
      <div className="product-card-body">
        <span className="meta">{product.coleccion}</span>
        <Link to={to} className="product-card-title">
          {product.nombre}
        </Link>
        <div className="product-card-footer">
          <div className="price">
            <strong>{formatMoney(product.precioFinal)}</strong>
            {product.descuento > 0 && <s>{formatMoney(product.precio)}</s>}
          </div>
          <Button block disabled={agotado} onClick={() => addToCart(product)}>
            {agotado ? 'Sin stock' : 'Agregar al carrito'}
          </Button>
        </div>
      </div>
    </article>
  )
}
