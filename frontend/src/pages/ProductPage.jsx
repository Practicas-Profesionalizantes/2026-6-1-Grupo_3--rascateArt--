import { useState } from 'react'
import { Breadcrumb, Button, Skeleton } from 'antd'
import { Link, navigate } from '../lib/router'
import { formatMoney } from '../lib/format'
import { useShop } from '../context/ShopContext'
import ProductImage from '../components/ProductImage'
import ProductCard from '../components/ProductCard'
import QuantityInput from '../components/QuantityInput'
import EmptyState from '../components/EmptyState'

export default function ProductPage({ params }) {
  const { products, loading, addToCart, config } = useShop()
  const [qty, setQty] = useState(1)
  const product = products.find((p) => String(p.id) === params.id)

  if (loading) {
    return (
      <div className="container">
        <div className="product-detail" style={{ paddingTop: 72 }}>
          <Skeleton.Node active style={{ width: '100%', height: 420 }} />
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container narrow">
        <EmptyState
          title="Este producto ya no está disponible"
          text="Puede que se haya agotado o que lo hayamos sacado del catálogo."
          action={<Button type="primary" onClick={() => navigate('/')}>Ver el catálogo</Button>}
        />
      </div>
    )
  }

  const agotado = product.stock === 0
  const related = products.filter((p) => p.coleccion === product.coleccion && p.id !== product.id).slice(0, 4)

  return (
    <div className="container">
      <Breadcrumb
        className="crumbs"
        items={[
          { title: <Link to="/">Tienda</Link> },
          { title: <Link to={`/coleccion/${encodeURIComponent(product.coleccion)}`}>{product.coleccion}</Link> },
          { title: product.nombre },
        ]}
      />
      <div className="product-detail">
        <div className="product-detail-media">
          <ProductImage src={product.imagen} alt={product.nombre} />
          {product.descuento > 0 && <span className="tag-sale">-{product.descuento}%</span>}
        </div>
        <div className="product-detail-info">
          <div>
            <span className="meta">{product.coleccion}</span>
            <h1>{product.nombre}</h1>
          </div>
          <div className="price price-lg">
            <strong>{formatMoney(product.precioFinal)}</strong>
            {product.descuento > 0 && <s>{formatMoney(product.precio)}</s>}
          </div>
          <p className="product-description">
            {product.descripcion || 'Pieza artesanal de Rascate Art. Escribinos para consultar medidas, colores y tiempos de entrega.'}
          </p>
          {product.stock !== null && (
            <p className={agotado ? 'stock stock-out' : 'stock'}>
              {agotado ? 'Sin stock por el momento' : product.stock <= 3 ? `Quedan ${product.stock} unidades` : 'En stock'}
            </p>
          )}
          <div className="buy-row">
            <QuantityInput value={qty} onChange={setQty} max={product.stock ?? 99} />
            <Button size="large" disabled={agotado} onClick={() => addToCart(product, qty)}>
              Agregar al carrito
            </Button>
          </div>
          <Button
            type="primary"
            size="large"
            block
            disabled={agotado}
            onClick={() => {
              addToCart(product, qty)
              navigate('/checkout')
            }}
          >
            Comprar ahora
          </Button>
          <ul className="product-facts">
            <li>
              <strong>Pago:</strong> tarjeta, dinero en cuenta o efectivo con Mercado Pago.
            </li>
            <li>
              <strong>Entrega:</strong> envío a domicilio
              {config.shippingCost ? ` (${formatMoney(config.shippingCost)})` : ''} o retiro coordinado.
            </li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="related">
          <h2 className="section-title">Más de {product.coleccion}</h2>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
