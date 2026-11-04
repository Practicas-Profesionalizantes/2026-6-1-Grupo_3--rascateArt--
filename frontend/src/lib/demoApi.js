import seed from '../../../backend/src/seed-products.json'

const KEY = 'rascate:demo-db'
const PAGADOS = ['pagado', 'en_preparacion', 'enviado', 'entregado']
export const DEMO_ADMIN = { email: 'demo@rascateart.com', password: 'demo1234' }

class DemoError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const fail = (s, m) => {
  throw new DemoError(s, m)
}

const now = () => new Date().toISOString()
const finalPrice = (p) => Math.round(p.precio * (1 - (p.descuento || 0) / 100))

function fresh() {
  return {
    seq: { user: 1, product: seed.length, order: 0, payment: 7000 },
    users: [{ id: 1, nombre: 'Admin Demo', email: DEMO_ADMIN.email, password: DEMO_ADMIN.password, telefono: '', direccion: '', rol: 'admin', created_at: now() }],
    products: seed.map((p, i) => ({ id: i + 1, ...p, stock: null, activo: true, destacado: false })),
    orders: [],
    payments: {},
  }
}

let memory = null
function load() {
  if (memory) return memory
  try {
    memory = JSON.parse(localStorage.getItem(KEY)) || fresh()
  } catch {
    memory = fresh()
  }
  return memory
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory))
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
}

const publicUser = (u) => u && { id: u.id, nombre: u.nombre, email: u.email, telefono: u.telefono, direccion: u.direccion, rol: u.rol }
const serialize = (p) => ({ ...p, precioFinal: finalPrice(p) })
const orderOut = (o) => ({
  id: o.id, nombre: o.nombre, email: o.email, telefono: o.telefono, entrega: o.entrega, direccion: o.direccion, notas: o.notas,
  subtotal: o.subtotal, envio: o.envio, total: o.total, estado: o.estado, mpStatus: o.mp_status, mpPaymentType: o.mp_payment_type,
  mpPaymentId: o.mp_payment_id, mpStatusDetail: o.mp_status_detail, userId: o.user_id, createdAt: o.created_at, updatedAt: o.updated_at,
  items: o.items.map((i) => ({ productId: i.product_id, nombre: i.nombre, precio: i.precio_unitario, cantidad: i.cantidad })),
})

function adjustStock(db, order, sign) {
  for (const i of order.items) {
    const p = db.products.find((x) => x.id === i.product_id)
    if (p && p.stock !== null) p.stock = Math.max(p.stock + sign * i.cantidad, 0)
  }
}

function applyPayment(db, pay) {
  const o = db.orders.find((x) => x.id === pay.orderId)
  if (!o) return null
  const paid = PAGADOS.includes(o.estado)
  if (pay.status === 'approved') o.estado = paid ? o.estado : 'pagado'
  else if (pay.status === 'rejected') o.estado = paid ? o.estado : 'rechazado'
  else if (!paid) o.estado = 'pendiente'
  if (PAGADOS.includes(o.estado) && !o.stock_descontado) {
    adjustStock(db, o, -1)
    o.stock_descontado = true
  }
  Object.assign(o, { mp_payment_id: String(pay.id), mp_status: pay.status, mp_payment_type: pay.type, updated_at: now() })
  return o
}

export async function demoApi(path, { method = 'GET', body, raw, token }) {
  await new Promise((r) => setTimeout(r, 150))
  const db = load()
  const url = new URL(path, 'http://demo')
  const p = url.pathname
  const b = body || {}
  const user = token ? db.users.find((u) => String(u.id) === token) : null
  const needUser = () => user || fail(401, 'Tenés que iniciar sesión')
  const needAdmin = () => (needUser().rol === 'admin' ? user : fail(403, 'No tenés permisos'))
  let m
  const done = (v) => {
    save()
    return v
  }

  if (p === '/api/config') {
    return {
      mpEnabled: true,
      mailEnabled: false,
      shippingCost: 6500,
      freeShippingFrom: 150000,
      colecciones: [...new Set(db.products.filter((x) => x.activo).map((x) => x.coleccion))].sort(),
    }
  }
  if (p === '/api/products') return db.products.filter((x) => x.activo).sort((a, c) => c.destacado - a.destacado || a.id - c.id).map(serialize)

  if (p === '/api/auth/register') {
    const email = String(b.email || '').trim().toLowerCase()
    if (db.users.some((u) => u.email === email)) fail(409, 'Ya existe una cuenta con ese email')
    const u = { id: ++db.seq.user, nombre: b.nombre, email, password: b.password, telefono: b.telefono || '', direccion: b.direccion || '', rol: 'cliente', created_at: now() }
    db.users.push(u)
    return done({ token: String(u.id), user: publicUser(u) })
  }
  if (p === '/api/auth/login') {
    const u = db.users.find((x) => x.email === String(b.email || '').trim().toLowerCase())
    if (!u || u.password !== b.password) fail(401, 'Email o contraseña incorrectos')
    return { token: String(u.id), user: publicUser(u) }
  }
  if (p === '/api/auth/me' && method === 'GET') return { user: publicUser(needUser()) }
  if (p === '/api/auth/me' && method === 'PUT') {
    const u = needUser()
    if (b.passwordNueva) {
      if (b.passwordActual !== u.password) fail(400, 'La contraseña actual no es correcta')
      u.password = b.passwordNueva
    }
    Object.assign(u, { nombre: b.nombre || u.nombre, telefono: b.telefono || '', direccion: b.direccion || '' })
    return done({ user: publicUser(u) })
  }

  if (p === '/api/orders' && method === 'POST') {
    const items = []
    for (const it of b.items || []) {
      const prod = db.products.find((x) => x.id === it.id && x.activo)
      if (!prod) fail(409, 'Uno de los productos ya no está disponible')
      if (prod.stock !== null && prod.stock < it.cantidad) fail(409, `Solo quedan ${prod.stock} unidades de ${prod.nombre}`)
      items.push({ product_id: prod.id, nombre: prod.nombre, precio_unitario: finalPrice(prod), cantidad: it.cantidad })
    }
    if (!items.length) fail(400, 'El carrito está vacío')
    const subtotal = items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)
    const envio = b.entrega === 'envio' && subtotal < 150000 ? 6500 : 0
    const o = {
      id: ++db.seq.order, user_id: user?.id ?? null, access_key: Math.random().toString(36).slice(2), ...b.cliente,
      entrega: b.entrega, direccion: b.entrega === 'envio' ? b.cliente.direccion : '', notas: b.notas || '',
      subtotal, envio, total: subtotal + envio, estado: 'pendiente', items, created_at: now(), updated_at: now(),
    }
    db.orders.push(o)
    return done({ orderId: o.id, accessKey: o.access_key, initPoint: `/mercadopago/${o.id}` })
  }
  if (p === '/api/orders/mine') return db.orders.filter((o) => o.user_id === needUser().id).sort((a, c) => c.id - a.id).map(orderOut)
  if ((m = p.match(/^\/api\/orders\/(\d+)\/pay$/))) return { initPoint: `/mercadopago/${m[1]}` }
  if ((m = p.match(/^\/api\/orders\/(\d+)$/))) {
    const o = db.orders.find((x) => x.id === Number(m[1]))
    if (!o) fail(404, 'Pedido no encontrado')
    return orderOut(o)
  }
  if (p === '/api/demo/pay') {
    const id = ++db.seq.payment
    db.payments[id] = { id, orderId: Number(b.orderId), status: b.status, type: b.type }
    return done({ paymentId: id })
  }
  if (p === '/api/payments/confirm') {
    const pay = db.payments[b.paymentId]
    if (!pay) fail(404, 'Pago no encontrado')
    const o = applyPayment(db, pay)
    return done({ orderId: o.id, estado: o.estado })
  }

  if (p.startsWith('/api/admin/')) needAdmin()
  if (p === '/api/admin/products' && method === 'GET') return [...db.products].sort((a, c) => c.id - a.id).map(serialize)
  if (p === '/api/admin/products' && method === 'POST') {
    const prod = { id: ++db.seq.product, descripcion: '', imagen: '', stock: null, activo: true, destacado: false, ...b }
    db.products.push(prod)
    return done(serialize(prod))
  }
  if ((m = p.match(/^\/api\/admin\/products\/(\d+)$/))) {
    const i = db.products.findIndex((x) => x.id === Number(m[1]))
    if (i < 0) fail(404, 'Producto no encontrado')
    if (method === 'DELETE') {
      db.products.splice(i, 1)
      return done(null)
    }
    Object.assign(db.products[i], b)
    return done(serialize(db.products[i]))
  }
  if (p === '/api/admin/uploads') {
    const dataUrl = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, 600 / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new DemoError(400, 'El archivo no es una imagen válida'))
      img.src = URL.createObjectURL(raw)
    })
    return { url: dataUrl }
  }
  if (p === '/api/admin/stats') {
    const paid = db.orders.filter((o) => PAGADOS.includes(o.estado))
    const month = new Date().toISOString().slice(0, 7)
    const top = {}
    for (const o of paid) for (const i of o.items) top[i.nombre] = (top[i.nombre] || 0) + i.cantidad
    const porEstado = {}
    for (const o of db.orders) porEstado[o.estado] = (porEstado[o.estado] || 0) + 1
    return {
      productos: db.products.length,
      productosActivos: db.products.filter((x) => x.activo).length,
      sinStock: db.products.filter((x) => x.activo && x.stock === 0).length,
      usuarios: db.users.filter((u) => u.rol === 'cliente').length,
      pedidos: db.orders.length,
      pedidosPagados: paid.length,
      ventasTotal: paid.reduce((s, o) => s + o.total, 0),
      ventasMes: paid.filter((o) => o.created_at.startsWith(month)).reduce((s, o) => s + o.total, 0),
      porEstado,
      topProductos: Object.entries(top).sort((a, c) => c[1] - a[1]).slice(0, 5).map(([nombre, unidades]) => ({ nombre, unidades })),
      ultimos: [...db.orders].sort((a, c) => c.id - a.id).slice(0, 6).map(orderOut),
    }
  }
  if (p === '/api/admin/orders') return [...db.orders].sort((a, c) => c.id - a.id).map(orderOut)
  if ((m = p.match(/^\/api\/admin\/orders\/(\d+)$/))) {
    const o = db.orders.find((x) => x.id === Number(m[1]))
    if (PAGADOS.includes(b.estado) && !o.stock_descontado) {
      adjustStock(db, o, -1)
      o.stock_descontado = true
    } else if (['cancelado', 'rechazado'].includes(b.estado) && o.stock_descontado) {
      adjustStock(db, o, 1)
      o.stock_descontado = false
    }
    Object.assign(o, { estado: b.estado, updated_at: now() })
    return done(orderOut(o))
  }
  if (p === '/api/admin/users') {
    return db.users.map((u) => {
      const mine = db.orders.filter((o) => o.user_id === u.id)
      return { ...publicUser(u), createdAt: u.created_at, pedidos: mine.length, gastado: mine.filter((o) => PAGADOS.includes(o.estado)).reduce((s, o) => s + o.total, 0) }
    })
  }
  if ((m = p.match(/^\/api\/admin\/users\/(\d+)$/))) {
    const u = db.users.find((x) => x.id === Number(m[1]))
    if (u.id === user.id) fail(400, 'No podés quitarte el rol de administrador')
    u.rol = b.rol
    return done(publicUser(u))
  }
  fail(404, 'Ruta no encontrada')
}
