import { useMemo, useState } from 'react'
import { Button, Input, Select, Skeleton } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { Link, navigate } from '../lib/router'
import { formatMoney } from '../lib/format'
import { useShop } from '../context/ShopContext'
import ProductCard from '../components/ProductCard'
import ProductImage from '../components/ProductImage'
import EmptyState from '../components/EmptyState'

const SORTS = [
  { value: 'destacados', label: 'Destacados' },
  { value: 'precio-asc', label: 'Menor precio' },
  { value: 'precio-desc', label: 'Mayor precio' },
  { value: 'ofertas', label: 'Ofertas primero' },
]

export default function HomePage({ params }) {
  const { products, loading, error, reload, config } = useShop()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('destacados')
  const coleccion = params.coleccion || null

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    let r = products.filter((p) => (!coleccion || p.coleccion === coleccion) && (!term || p.nombre.toLowerCase().includes(term)))
    if (sort === 'destacados') r = [...r].sort((a, b) => b.destacado - a.destacado || !!b.imagen - !!a.imagen)
    if (sort === 'precio-asc') r = [...r].sort((a, b) => a.precioFinal - b.precioFinal)
    if (sort === 'precio-desc') r = [...r].sort((a, b) => b.precioFinal - a.precioFinal)
    if (sort === 'ofertas') r = [...r].sort((a, b) => b.descuento - a.descuento)
    return r
  }, [products, coleccion, q, sort])

  const showcase = useMemo(
    () => [...products].filter((p) => p.imagen).sort((a, b) => b.destacado - a.destacado).slice(0, 4),
    [products]
  )

  const scrollToCatalog = () => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="container">
      {!coleccion && (
        <section className="hero">
          <div className="hero-copy">
            <span className="meta">Hecho a mano en Argentina</span>
            <h1>Exclusividad y confort para tu gato</h1>
            <p className="hero-lead">
              Rascadores, torres y juguetes artesanales para que tu gato juegue, descanse y se rasque donde corresponde.
            </p>
            <div className="hero-cta">
              <Button type="primary" size="large" onClick={scrollToCatalog}>
                Ver catálogo
              </Button>
              <Button size="large" onClick={() => navigate('/coleccion/Premium')}>
                Ver línea Premium
              </Button>
            </div>
            <ul className="hero-facts">
              <li>Pagá con Mercado Pago</li>
              <li>Envío a domicilio o retiro</li>
              {config.freeShippingFrom > 0 && <li>Envío gratis desde {formatMoney(config.freeShippingFrom)}</li>}
            </ul>
          </div>
          {showcase.length > 0 && (
            <div className="hero-grid">
              {showcase.map((p) => (
                <Link key={p.id} to={`/producto/${p.id}`} className="hero-tile">
                  <ProductImage src={p.imagen} alt="" />
                  <span>{p.nombre}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="catalog" id="catalogo">
        <div className="catalog-head" style={coleccion ? { borderTop: 0, paddingTop: 40 } : undefined}>
          <div>
            <h2 className="section-title">{coleccion || 'Catálogo'}</h2>
            {!loading && !error && <span className="muted small">{list.length} productos</span>}
          </div>
          <div className="catalog-tools">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Buscar por nombre"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar productos"
            />
            <Select value={sort} onChange={setSort} options={SORTS} aria-label="Ordenar productos" style={{ minWidth: 176 }} />
          </div>
        </div>

        {config.colecciones.length > 0 && (
          <nav className="filters" aria-label="Colecciones">
            <Link to="/" className={`filter ${!coleccion ? 'active' : ''}`}>
              Todo
            </Link>
            {config.colecciones.map((c) => (
              <Link key={c} to={`/coleccion/${encodeURIComponent(c)}`} className={`filter ${coleccion === c ? 'active' : ''}`}>
                {c}
              </Link>
            ))}
          </nav>
        )}

        {error ? (
          <EmptyState
            title="No pudimos cargar el catálogo"
            text="Revisá tu conexión y volvé a intentar."
            action={<Button type="primary" onClick={reload}>Cargar de nuevo</Button>}
          />
        ) : loading ? (
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="product-card">
                <Skeleton.Node active style={{ width: '100%', height: 220 }} />
                <div className="product-card-body">
                  <Skeleton active title={false} paragraph={{ rows: 2 }} />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="No hay productos con esa búsqueda"
            text="Probá con otra palabra o mirá todo el catálogo."
            action={
              <Button
                onClick={() => {
                  setQ('')
                  navigate('/')
                }}
              >
                Ver todo el catálogo
              </Button>
            }
          />
        ) : (
          <div className="product-grid">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
