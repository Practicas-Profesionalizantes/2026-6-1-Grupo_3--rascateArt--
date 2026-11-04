import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { App } from 'antd'
import { api } from '../lib/api'

const ShopContext = createContext(null)
const CART_KEY = 'rascate:cart'

const readCart = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.id && i.cantidad > 0) : []
  } catch {
    return []
  }
}

const snapshot = (p) => ({ id: p.id, nombre: p.nombre, precioFinal: p.precioFinal, precio: p.precio, imagen: p.imagen, stock: p.stock })

export function ShopProvider({ children }) {
  const { message } = App.useApp()
  const [products, setProducts] = useState([])
  const [config, setConfig] = useState({ mpEnabled: true, shippingCost: 0, freeShippingFrom: 0, colecciones: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cart, setCart] = useState(readCart)
  const [cartOpen, setCartOpen] = useState(false)

  const fetchCatalog = useCallback(
    () =>
      Promise.all([api('/api/products'), api('/api/config')])
        .then(([prods, cfg]) => {
          setProducts(prods)
          setConfig(cfg)
          setError(null)
          setCart((prev) =>
            prev.flatMap((item) => {
              const p = prods.find((x) => x.id === item.id)
              if (!p) return []
              const cantidad = p.stock === null ? item.cantidad : Math.min(item.cantidad, p.stock)
              return cantidad > 0 ? [{ ...snapshot(p), cantidad }] : []
            })
          )
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  )

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  const loadCatalog = useCallback(() => {
    setLoading(true)
    setError(null)
    return fetchCatalog()
  }, [fetchCatalog])

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      /* almacenamiento no disponible */
    }
  }, [cart])

  const addToCart = useCallback(
    (product, cantidad = 1) => {
      const current = cart.find((i) => i.id === product.id)?.cantidad || 0
      if (product.stock !== null && current + cantidad > product.stock) {
        message.warning(product.stock > 0 ? `Solo hay ${product.stock} unidades disponibles` : 'Producto sin stock')
        return
      }
      setCart((prev) => {
        const exists = prev.find((i) => i.id === product.id)
        if (exists) return prev.map((i) => (i.id === product.id ? { ...i, cantidad: i.cantidad + cantidad } : i))
        return [...prev, { ...snapshot(product), cantidad }]
      })
      message.success(`${product.nombre} se agregó al carrito`)
    },
    [cart, message]
  )

  const setQuantity = useCallback((id, cantidad) => {
    setCart((prev) =>
      prev.flatMap((i) => {
        if (i.id !== id) return [i]
        if (cantidad <= 0) return []
        const max = i.stock === null ? 99 : i.stock
        return [{ ...i, cantidad: Math.min(cantidad, max) }]
      })
    )
  }, [])

  const removeFromCart = useCallback((id) => setCart((prev) => prev.filter((i) => i.id !== id)), [])
  const clearCart = useCallback(() => setCart([]), [])

  const value = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.precioFinal * i.cantidad, 0)
    const count = cart.reduce((s, i) => s + i.cantidad, 0)
    return {
      products,
      config,
      loading,
      error,
      reload: loadCatalog,
      cart,
      cartOpen,
      setCartOpen,
      addToCart,
      setQuantity,
      removeFromCart,
      clearCart,
      subtotal,
      count,
    }
  }, [products, config, loading, error, loadCatalog, cart, cartOpen, addToCart, setQuantity, removeFromCart, clearCart])

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useShop = () => useContext(ShopContext)

// eslint-disable-next-line react-refresh/only-export-components
export function shippingFor(config, subtotal, entrega) {
  if (entrega !== 'envio' || !config.shippingCost) return 0
  if (config.freeShippingFrom && subtotal >= config.freeShippingFrom) return 0
  return config.shippingCost
}
