import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { db, tx } from './db.js';
import { Router, fail, readJson, readBody } from './http.js';
import { hashPassword, verifyPassword, createToken, verifyToken, publicUser, rateLimit } from './auth.js';
import { mpEnabled, createPreference, getPayment, verifyWebhookSignature } from './mercadopago.js';
import { sendOrderEmails, sendWelcomeEmail, mailEnabled } from './mailer.js';

export const router = new Router();

export const ESTADOS = ['pendiente', 'pagado', 'rechazado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'];
const PAGADOS = ['pagado', 'en_preparacion', 'enviado', 'entregado'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v) => (Number.isInteger(Number(v)) && v !== '' && v !== null ? Number(v) : NaN);
const finalPrice = (p) => Math.round(p.precio * (1 - (p.descuento || 0) / 100));

function loadUser(ctx) {
  const header = ctx.req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = token && verifyToken(token);
  ctx.user = payload ? db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) || null : null;
}

function requireAuth(ctx) {
  if (!ctx.user) fail(401, 'Tenés que iniciar sesión');
}

function requireAdmin(ctx) {
  requireAuth(ctx);
  if (ctx.user.rol !== 'admin') fail(403, 'No tenés permisos para esta acción');
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

function serializeProduct(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: p.precio,
    descuento: p.descuento,
    precioFinal: finalPrice(p),
    coleccion: p.coleccion,
    stock: p.stock,
    imagen: p.imagen,
    activo: Boolean(p.activo),
    destacado: Boolean(p.destacado),
  };
}

function orderWithItems(order, { admin = false } = {}) {
  if (!order) return null;
  const items = db
    .prepare('SELECT product_id, nombre, precio_unitario, cantidad FROM order_items WHERE order_id = ?')
    .all(order.id);
  const base = {
    id: order.id,
    nombre: order.nombre,
    email: order.email,
    telefono: order.telefono,
    entrega: order.entrega,
    direccion: order.direccion,
    notas: order.notas,
    subtotal: order.subtotal,
    envio: order.envio,
    total: order.total,
    estado: order.estado,
    mpStatus: order.mp_status,
    mpPaymentType: order.mp_payment_type,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((i) => ({ productId: i.product_id, nombre: i.nombre, precio: i.precio_unitario, cantidad: i.cantidad })),
  };
  if (admin) {
    Object.assign(base, {
      userId: order.user_id,
      mpPaymentId: order.mp_payment_id,
      mpStatusDetail: order.mp_status_detail,
      mpPreferenceId: order.mp_preference_id,
    });
  }
  return base;
}

function adjustStock(orderId, sign) {
  const items = db.prepare('SELECT product_id, cantidad FROM order_items WHERE order_id = ?').all(orderId);
  const upd = db.prepare(
    "UPDATE products SET stock = MAX(stock + ?, 0), updated_at = datetime('now') WHERE id = ? AND stock IS NOT NULL"
  );
  for (const i of items) if (i.product_id) upd.run(sign * i.cantidad, i.product_id);
}

function notify(order, prevEstado) {
  if (!order || order.estado === prevEstado) return;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  sendOrderEmails(order, items, prevEstado).catch((err) => console.error(err));
}

export function applyPayment(payment) {
  const orderId = int(payment.external_reference ?? payment.metadata?.order_id);
  if (!orderId) return null;
  let prevEstado = null;
  const updated = tx(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return null;
    prevEstado = order.estado;

    const paymentId = String(payment.id);
    const status = payment.status;
    const alreadyPaid = PAGADOS.includes(order.estado);
    const isCurrentPayment = order.mp_payment_id === paymentId;

    if (alreadyPaid && !isCurrentPayment && status !== 'approved') return order;
    if (order.estado === 'cancelado' && status !== 'approved') return order;

    let estado = order.estado;
    let detail = payment.status_detail || '';

    if (status === 'approved') {
      const amountOk =
        payment.currency_id === 'ARS' && Number(payment.transaction_amount) + 1 >= order.total;
      if (amountOk) {
        if (!alreadyPaid) estado = 'pagado';
      } else {
        estado = 'pendiente';
        detail = 'monto_no_coincide';
        console.error(`Pedido ${order.id}: monto pagado ${payment.transaction_amount} no coincide con ${order.total}`);
      }
    } else if (['refunded', 'charged_back'].includes(status)) {
      estado = 'cancelado';
    } else if (['rejected', 'cancelled'].includes(status)) {
      if (!alreadyPaid) estado = 'rechazado';
    } else if (!alreadyPaid) {
      estado = 'pendiente';
    }

    let stockFlag = order.stock_descontado;
    if (PAGADOS.includes(estado) && !stockFlag) {
      adjustStock(order.id, -1);
      stockFlag = 1;
    } else if (estado === 'cancelado' && stockFlag) {
      adjustStock(order.id, +1);
      stockFlag = 0;
    }

    db.prepare(
      `UPDATE orders SET estado = ?, mp_payment_id = ?, mp_status = ?, mp_status_detail = ?, mp_payment_type = ?,
       stock_descontado = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(estado, paymentId, status, detail, payment.payment_type_id || '', stockFlag, order.id);

    return db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  });
  notify(updated, prevEstado);
  return updated;
}

router.get('/api/health', () => ({ ok: true }));

router.get('/api/config', () => {
  const colecciones = db
    .prepare('SELECT DISTINCT coleccion FROM products WHERE activo = 1 ORDER BY coleccion')
    .all()
    .map((r) => r.coleccion);
  return {
    mpEnabled: mpEnabled(),
    mailEnabled: mailEnabled(),
    shippingCost: config.shipping.cost,
    freeShippingFrom: config.shipping.freeFrom,
    colecciones,
  };
});

router.post('/api/auth/register', async (ctx) => {
  if (!rateLimit(`reg:${clientIp(ctx.req)}`, 10)) fail(429, 'Demasiados intentos, probá en unos minutos');
  const b = await readJson(ctx.req);
  const nombre = str(b.nombre, 100);
  const email = str(b.email, 150).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  if (nombre.length < 2) fail(400, 'Ingresá tu nombre');
  if (!EMAIL_RE.test(email)) fail(400, 'Ingresá un email válido');
  if (password.length < 6) fail(400, 'La contraseña debe tener al menos 6 caracteres');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'Ya existe una cuenta con ese email');
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (nombre, email, password_hash, telefono, direccion) VALUES (?, ?, ?, ?, ?)')
    .run(nombre, email, hashPassword(password), str(b.telefono, 30), str(b.direccion, 200));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  sendWelcomeEmail(user);
  ctx.status = 201;
  return { token: createToken(user), user: publicUser(user) };
});

router.post('/api/auth/login', async (ctx) => {
  const b = await readJson(ctx.req);
  const email = str(b.email, 150).toLowerCase();
  if (!rateLimit(`login:${clientIp(ctx.req)}:${email}`, 8)) fail(429, 'Demasiados intentos, probá en unos minutos');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(String(b.password || ''), user.password_hash)) fail(401, 'Email o contraseña incorrectos');
  return { token: createToken(user), user: publicUser(user) };
});

router.get('/api/auth/me', requireAuth, (ctx) => ({ user: publicUser(ctx.user) }));

router.put('/api/auth/me', requireAuth, async (ctx) => {
  const b = await readJson(ctx.req);
  const nombre = str(b.nombre, 100) || ctx.user.nombre;
  let hash = ctx.user.password_hash;
  if (b.passwordNueva) {
    if (!verifyPassword(String(b.passwordActual || ''), ctx.user.password_hash)) fail(400, 'La contraseña actual no es correcta');
    if (String(b.passwordNueva).length < 6) fail(400, 'La nueva contraseña debe tener al menos 6 caracteres');
    hash = hashPassword(String(b.passwordNueva));
  }
  db.prepare('UPDATE users SET nombre = ?, telefono = ?, direccion = ?, password_hash = ? WHERE id = ?').run(
    nombre,
    str(b.telefono, 30),
    str(b.direccion, 200),
    hash,
    ctx.user.id
  );
  return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.user.id)) };
});

router.get('/api/products', () =>
  db.prepare('SELECT * FROM products WHERE activo = 1 ORDER BY destacado DESC, id').all().map(serializeProduct)
);

router.get('/api/products/:id', (ctx) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND activo = 1').get(int(ctx.params.id));
  if (!p) fail(404, 'Producto no encontrado');
  return serializeProduct(p);
});

router.post('/api/orders', async (ctx) => {
  if (!rateLimit(`order:${clientIp(ctx.req)}`, 30, 10 * 60 * 1000)) fail(429, 'Demasiados pedidos, probá en unos minutos');
  if (!mpEnabled()) fail(503, 'Los pagos no están disponibles en este momento');
  const b = await readJson(ctx.req);
  const c = b.cliente || {};
  const nombre = str(c.nombre, 100);
  const email = str(c.email, 150).toLowerCase();
  const telefono = str(c.telefono, 30);
  const entrega = b.entrega === 'retiro' ? 'retiro' : 'envio';
  const direccion = str(c.direccion, 200);
  const notas = str(b.notas, 500);

  if (nombre.length < 2) fail(400, 'Ingresá tu nombre');
  if (!EMAIL_RE.test(email)) fail(400, 'Ingresá un email válido');
  if (telefono.replace(/\D/g, '').length < 6) fail(400, 'Ingresá un teléfono válido');
  if (entrega === 'envio' && direccion.length < 5) fail(400, 'Ingresá la dirección de envío');
  if (!Array.isArray(b.items) || b.items.length === 0) fail(400, 'El carrito está vacío');
  if (b.items.length > 50) fail(400, 'Demasiados productos en el carrito');

  const merged = new Map();
  for (const it of b.items) {
    const id = int(it.id);
    const cantidad = int(it.cantidad);
    if (!id || !cantidad || cantidad < 1 || cantidad > 99) fail(400, 'Cantidad inválida en el carrito');
    merged.set(id, (merged.get(id) || 0) + cantidad);
  }

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ? AND activo = 1');
  const items = [];
  for (const [id, cantidad] of merged) {
    const p = getProduct.get(id);
    if (!p) fail(409, 'Uno de los productos ya no está disponible. Revisá tu carrito.');
    if (p.stock !== null && p.stock < cantidad) {
      fail(409, p.stock > 0 ? `Solo quedan ${p.stock} unidades de ${p.nombre}` : `${p.nombre} está sin stock`);
    }
    items.push({ product_id: p.id, nombre: p.nombre, precio_unitario: finalPrice(p), cantidad });
  }

  const subtotal = items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
  const { cost, freeFrom } = config.shipping;
  const envio = entrega === 'envio' && cost > 0 && !(freeFrom > 0 && subtotal >= freeFrom) ? cost : 0;
  const total = subtotal + envio;
  const accessKey = crypto.randomBytes(18).toString('base64url');

  const order = tx(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO orders (user_id, access_key, nombre, email, telefono, entrega, direccion, notas, subtotal, envio, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(ctx.user?.id ?? null, accessKey, nombre, email, telefono, entrega, entrega === 'envio' ? direccion : '', notas, subtotal, envio, total);
    const ins = db.prepare(
      'INSERT INTO order_items (order_id, product_id, nombre, precio_unitario, cantidad) VALUES (?, ?, ?, ?, ?)'
    );
    for (const i of items) ins.run(lastInsertRowid, i.product_id, i.nombre, i.precio_unitario, i.cantidad);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(lastInsertRowid);
  });

  let preference;
  try {
    preference = await createPreference(order, items);
  } catch (err) {
    db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
    throw err;
  }
  db.prepare("UPDATE orders SET mp_preference_id = ?, updated_at = datetime('now') WHERE id = ?").run(preference.id, order.id);

  if (ctx.user && (!ctx.user.telefono || !ctx.user.direccion)) {
    db.prepare("UPDATE users SET telefono = COALESCE(NULLIF(telefono, ''), ?), direccion = COALESCE(NULLIF(direccion, ''), ?) WHERE id = ?").run(
      telefono,
      direccion,
      ctx.user.id
    );
  }

  ctx.status = 201;
  return { orderId: order.id, accessKey, initPoint: preference.init_point };
});

router.get('/api/orders/mine', requireAuth, (ctx) =>
  db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 100')
    .all(ctx.user.id)
    .map((o) => orderWithItems(o))
);

router.get('/api/orders/:id', (ctx) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(int(ctx.params.id));
  const key = str(ctx.query.get('key'), 100);
  const owns = order && ctx.user && (order.user_id === ctx.user.id || ctx.user.rol === 'admin');
  const keyOk =
    order && key && key.length === order.access_key.length &&
    crypto.timingSafeEqual(Buffer.from(key), Buffer.from(order.access_key));
  if (!order || (!owns && !keyOk)) fail(404, 'Pedido no encontrado');
  return orderWithItems(order);
});

router.post('/api/orders/:id/pay', async (ctx) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(int(ctx.params.id));
  const b = await readJson(ctx.req);
  const owns = order && ctx.user && order.user_id === ctx.user.id;
  const keyOk = order && b.key && b.key === order.access_key;
  if (!order || (!owns && !keyOk)) fail(404, 'Pedido no encontrado');
  if (!['pendiente', 'rechazado'].includes(order.estado)) fail(409, 'Este pedido ya no se puede pagar');
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const preference = await createPreference({ ...order, access_key: `${order.access_key}-${Date.now()}` }, items);
  db.prepare("UPDATE orders SET mp_preference_id = ?, updated_at = datetime('now') WHERE id = ?").run(preference.id, order.id);
  return { initPoint: preference.init_point };
});

router.post('/api/payments/confirm', async (ctx) => {
  const b = await readJson(ctx.req);
  const paymentId = str(String(b.paymentId ?? ''), 40);
  if (!/^\d+$/.test(paymentId)) fail(400, 'Pago inválido');
  const payment = await getPayment(paymentId);
  const order = applyPayment(payment);
  if (!order) fail(404, 'Pedido no encontrado');
  return { orderId: order.id, estado: order.estado };
});

router.post('/api/payments/webhook', async (ctx) => {
  const body = await readJson(ctx.req).catch(() => ({}));
  const type = body.type || body.topic || ctx.query.get('type') || ctx.query.get('topic');
  const dataId = String(ctx.query.get('data.id') || body.data?.id || (type === 'payment' ? ctx.query.get('id') : '') || '');
  if (!verifyWebhookSignature(ctx.req, ctx.query.get('data.id') || dataId)) fail(401, 'Firma inválida');
  if (type !== 'payment' || !/^\d+$/.test(dataId)) return { received: true };
  const payment = await getPayment(dataId);
  const order = applyPayment(payment);
  console.log(`Webhook MP: pago ${dataId} (${payment.status}) → pedido ${order?.id ?? 'desconocido'} ${order?.estado ?? ''}`);
  return { received: true };
});

function readProductInput(b, current = {}) {
  const pick = (k) => (b[k] !== undefined ? b[k] : current[k]);
  const nombre = str(pick('nombre'), 120);
  const coleccion = str(pick('coleccion'), 60);
  const precio = int(pick('precio'));
  const descuento = int(pick('descuento') ?? 0);
  const stockRaw = pick('stock');
  const stock = stockRaw === null || stockRaw === '' || stockRaw === undefined ? null : int(stockRaw);
  if (nombre.length < 2) fail(400, 'El nombre es obligatorio');
  if (!coleccion) fail(400, 'La colección es obligatoria');
  if (!(precio >= 0)) fail(400, 'Precio inválido');
  if (!(descuento >= 0 && descuento <= 90)) fail(400, 'El descuento debe estar entre 0 y 90');
  if (stock !== null && !(stock >= 0)) fail(400, 'Stock inválido');
  return {
    nombre,
    descripcion: str(pick('descripcion'), 2000),
    precio,
    descuento,
    coleccion,
    stock,
    imagen: str(pick('imagen'), 300),
    activo: pick('activo') === undefined ? 1 : pick('activo') ? 1 : 0,
    destacado: pick('destacado') ? 1 : 0,
  };
}

router.get('/api/admin/products', requireAdmin, () =>
  db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(serializeProduct)
);

router.post('/api/admin/products', requireAdmin, async (ctx) => {
  const p = readProductInput(await readJson(ctx.req));
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO products (nombre, descripcion, precio, descuento, coleccion, stock, imagen, activo, destacado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(p.nombre, p.descripcion, p.precio, p.descuento, p.coleccion, p.stock, p.imagen, p.activo, p.destacado);
  ctx.status = 201;
  return serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(lastInsertRowid));
});

router.put('/api/admin/products/:id', requireAdmin, async (ctx) => {
  const id = int(ctx.params.id);
  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!current) fail(404, 'Producto no encontrado');
  const p = readProductInput(await readJson(ctx.req), current);
  db.prepare(
    `UPDATE products SET nombre = ?, descripcion = ?, precio = ?, descuento = ?, coleccion = ?, stock = ?, imagen = ?,
     activo = ?, destacado = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(p.nombre, p.descripcion, p.precio, p.descuento, p.coleccion, p.stock, p.imagen, p.activo, p.destacado, id);
  return serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

router.delete('/api/admin/products/:id', requireAdmin, (ctx) => {
  const { changes } = db.prepare('DELETE FROM products WHERE id = ?').run(int(ctx.params.id));
  if (!changes) fail(404, 'Producto no encontrado');
  ctx.status = 204;
});

const IMAGE_TYPES = {
  'image/jpeg': { ext: '.jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/png': { ext: '.png', magic: (b) => b.subarray(0, 4).toString('hex') === '89504e47' },
  'image/webp': { ext: '.webp', magic: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  'image/gif': { ext: '.gif', magic: (b) => b.subarray(0, 3).toString() === 'GIF' },
};

router.post('/api/admin/uploads', requireAdmin, async (ctx) => {
  const type = String(ctx.req.headers['content-type'] || '').split(';')[0].trim();
  const spec = IMAGE_TYPES[type];
  if (!spec) fail(415, 'Formato no soportado. Usá JPG, PNG, WEBP o GIF');
  const buf = await readBody(ctx.req, 5 * 1024 * 1024);
  if (buf.length < 12 || !spec.magic(buf)) fail(400, 'El archivo no es una imagen válida');
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${spec.ext}`;
  fs.writeFileSync(path.join(config.uploadsDir, name), buf);
  ctx.status = 201;
  return { url: `/uploads/${name}` };
});

router.get('/api/admin/stats', requireAdmin, () => {
  const placeholders = PAGADOS.map(() => '?').join(',');
  const ventas = db.prepare(`SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS n FROM orders WHERE estado IN (${placeholders})`).get(...PAGADOS);
  const mes = db
    .prepare(`SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE estado IN (${placeholders}) AND created_at >= date('now', 'start of month')`)
    .get(...PAGADOS);
  const porEstado = Object.fromEntries(
    db.prepare('SELECT estado, COUNT(*) AS n FROM orders GROUP BY estado').all().map((r) => [r.estado, r.n])
  );
  const top = db
    .prepare(
      `SELECT oi.nombre, SUM(oi.cantidad) AS unidades, SUM(oi.cantidad * oi.precio_unitario) AS monto
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.estado IN (${placeholders}) GROUP BY oi.nombre ORDER BY unidades DESC LIMIT 5`
    )
    .all(...PAGADOS);
  return {
    productos: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
    productosActivos: db.prepare('SELECT COUNT(*) AS n FROM products WHERE activo = 1').get().n,
    sinStock: db.prepare('SELECT COUNT(*) AS n FROM products WHERE stock = 0 AND activo = 1').get().n,
    usuarios: db.prepare("SELECT COUNT(*) AS n FROM users WHERE rol = 'cliente'").get().n,
    pedidos: db.prepare('SELECT COUNT(*) AS n FROM orders').get().n,
    pedidosPagados: ventas.n,
    ventasTotal: ventas.total,
    ventasMes: mes.total,
    porEstado,
    topProductos: top,
    ultimos: db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 6').all().map((o) => orderWithItems(o, { admin: true })),
  };
});

router.get('/api/admin/orders', requireAdmin, (ctx) => {
  const estado = ctx.query.get('estado');
  const rows = ESTADOS.includes(estado)
    ? db.prepare('SELECT * FROM orders WHERE estado = ? ORDER BY id DESC').all(estado)
    : db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  return rows.map((o) => orderWithItems(o, { admin: true }));
});

router.patch('/api/admin/orders/:id', requireAdmin, async (ctx) => {
  const id = int(ctx.params.id);
  const b = await readJson(ctx.req);
  if (!ESTADOS.includes(b.estado)) fail(400, 'Estado inválido');
  let prevEstado = null;
  const updated = tx(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) fail(404, 'Pedido no encontrado');
    prevEstado = order.estado;
    let flag = order.stock_descontado;
    if (PAGADOS.includes(b.estado) && !flag) {
      adjustStock(id, -1);
      flag = 1;
    } else if (['cancelado', 'rechazado'].includes(b.estado) && flag) {
      adjustStock(id, +1);
      flag = 0;
    }
    db.prepare("UPDATE orders SET estado = ?, stock_descontado = ?, updated_at = datetime('now') WHERE id = ?").run(b.estado, flag, id);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  });
  if (b.notificar !== false) notify(updated, prevEstado);
  return orderWithItems(updated, { admin: true });
});

router.get('/api/admin/users', requireAdmin, () =>
  db
    .prepare(
      `SELECT u.*, COUNT(o.id) AS pedidos, COALESCE(SUM(CASE WHEN o.estado IN ('pagado','en_preparacion','enviado','entregado') THEN o.total END), 0) AS gastado
       FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id ORDER BY u.id DESC`
    )
    .all()
    .map((u) => ({ ...publicUser(u), createdAt: u.created_at, pedidos: u.pedidos, gastado: u.gastado }))
);

router.patch('/api/admin/users/:id', requireAdmin, async (ctx) => {
  const id = int(ctx.params.id);
  const b = await readJson(ctx.req);
  if (!['cliente', 'admin'].includes(b.rol)) fail(400, 'Rol inválido');
  if (id === ctx.user.id && b.rol !== 'admin') fail(400, 'No podés quitarte el rol de administrador');
  const { changes } = db.prepare('UPDATE users SET rol = ? WHERE id = ?').run(b.rol, id);
  if (!changes) fail(404, 'Usuario no encontrado');
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
});

export { loadUser };
