import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const API_PORT = 4317;
const MP_PORT = 4318;
const BASE = `http://127.0.0.1:${API_PORT}`;
const WEBHOOK_SECRET = 'secreto-webhook';
const payments = new Map();
const preferences = [];
const emails = [];
const waitFor = async (fn, ms = 2000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((res) => setTimeout(res, 25));
  }
  return false;
};
let server;
let mock;
let dataDir;

function startMock() {
  return new Promise((resolve) => {
    mock = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'POST' && req.url === '/emails') {
        assert.equal(req.headers.authorization, 'Bearer re_test');
        emails.push(body);
        return res.end('{"id":"email"}');
      }
      if (req.headers.authorization !== 'Bearer TEST-token') {
        res.writeHead(401);
        return res.end('{"message":"unauthorized"}');
      }
      if (req.method === 'POST' && req.url === '/checkout/preferences') {
        preferences.push(body);
        const id = `pref-${preferences.length}`;
        return res.end(JSON.stringify({ id, init_point: `https://mp.test/checkout?pref=${id}` }));
      }
      const m = req.url.match(/^\/v1\/payments\/(\d+)$/);
      if (m && payments.has(m[1])) return res.end(JSON.stringify(payments.get(m[1])));
      res.writeHead(404);
      res.end('{"message":"not found"}');
    });
    mock.listen(MP_PORT, resolve);
  });
}

async function api(method, url, { body, token, headers = {}, raw } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

before(async () => {
  await startMock();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rascate-'));
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      PORT: String(API_PORT),
      DATA_DIR: dataDir,
      JWT_SECRET: 'test-secret',
      ADMIN_EMAIL: 'admin@rascate.test',
      ADMIN_PASSWORD: 'admin1234',
      MP_ACCESS_TOKEN: 'TEST-token',
      MP_WEBHOOK_SECRET: WEBHOOK_SECRET,
      MP_API_URL: `http://127.0.0.1:${MP_PORT}`,
      PUBLIC_URL: 'https://tienda.test',
      SHIPPING_COST: '5000',
      FREE_SHIPPING_FROM: '100000',
      RESEND_API_KEY: 're_test',
      MAIL_API_URL: `http://127.0.0.1:${MP_PORT}`,
      MAIL_FROM: 'Rascate Art <pedidos@rascate.test>',
      MAIL_NOTIFY: 'duena@rascate.test',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve) => server.stdout.on('data', (d) => d.toString().includes('escuchando') && resolve()));
});

after(() => {
  server?.kill();
  mock?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const state = {};

test('catálogo inicial', async () => {
  const { status, data } = await api('GET', '/api/products');
  assert.equal(status, 200);
  assert.equal(data.length, 25);
  const torre = data.find((p) => p.nombre === 'Torre Alta');
  assert.equal(torre.precioFinal, Math.round(84300 * 0.9));
  state.cascabel = data.find((p) => p.nombre === 'Pelota Cascabel').id;
  state.premium = data.find((p) => p.nombre === 'Doble Nivel Premium').id;
  const cfg = await api('GET', '/api/config');
  assert.equal(cfg.data.mpEnabled, true);
  assert.deepEqual(cfg.data.colecciones, ['Juguetes', 'Premium', 'Rascadores']);
});

test('registro, login y perfil', async () => {
  const reg = await api('POST', '/api/auth/register', {
    body: { nombre: 'Ana Gómez', email: 'Ana@Mail.com', password: 'secreta1', telefono: '1122334455' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.email, 'ana@mail.com');
  assert.equal(reg.data.user.rol, 'cliente');
  assert.ok(await waitFor(() => emails.some((e) => e.to[0] === 'ana@mail.com' && /Bienvenido/.test(e.subject))), 'email de bienvenida');
  const dup = await api('POST', '/api/auth/register', { body: { nombre: 'Ana', email: 'ana@mail.com', password: 'secreta1' } });
  assert.equal(dup.status, 409);
  const bad = await api('POST', '/api/auth/login', { body: { email: 'ana@mail.com', password: 'mal' } });
  assert.equal(bad.status, 401);
  const login = await api('POST', '/api/auth/login', { body: { email: 'ana@mail.com', password: 'secreta1' } });
  assert.equal(login.status, 200);
  state.token = login.data.token;
  const me = await api('PUT', '/api/auth/me', { token: state.token, body: { nombre: 'Ana G.', telefono: '1199887766', direccion: 'Calle 123' } });
  assert.equal(me.data.user.nombre, 'Ana G.');
  const admin = await api('POST', '/api/auth/login', { body: { email: 'admin@rascate.test', password: 'admin1234' } });
  assert.equal(admin.data.user.rol, 'admin');
  state.admin = admin.data.token;
  const forbidden = await api('GET', '/api/admin/stats', { token: state.token });
  assert.equal(forbidden.status, 403);
  const tampered = await api('GET', '/api/auth/me', { token: state.token.slice(0, -2) + 'xx' });
  assert.equal(tampered.status, 401);
});

test('admin crea producto con stock e imagen', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a50000000049454e44ae426082', 'hex');
  const up = await api('POST', '/api/admin/uploads', { token: state.admin, headers: { 'Content-Type': 'image/png' }, raw: png });
  assert.equal(up.status, 201);
  const file = await fetch(BASE + up.data.url);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/png');
  const fake = await api('POST', '/api/admin/uploads', { token: state.admin, headers: { 'Content-Type': 'image/png' }, raw: 'hola mundo, no soy png' });
  assert.equal(fake.status, 400);

  const created = await api('POST', '/api/admin/products', {
    token: state.admin,
    body: { nombre: 'Rascador Test', precio: 60000, descuento: 0, coleccion: 'Rascadores', stock: 3, imagen: up.data.url },
  });
  assert.equal(created.status, 201);
  state.productId = created.data.id;
});

test('pedido con envío, pago aprobado por webhook y descuento de stock', async () => {
  const noStock = await api('POST', '/api/orders', {
    body: { items: [{ id: state.productId, cantidad: 5 }], cliente: { nombre: 'Invitado', email: 'inv@mail.com', telefono: '1122334455', direccion: 'Calle 1 123' }, entrega: 'envio' },
  });
  assert.equal(noStock.status, 409);

  const order = await api('POST', '/api/orders', {
    token: state.token,
    body: {
      items: [{ id: state.productId, cantidad: 1 }, { id: state.cascabel, cantidad: 2 }, { id: state.cascabel, cantidad: 1 }],
      cliente: { nombre: 'Ana G.', email: 'ana@mail.com', telefono: '1199887766', direccion: 'Calle 123' },
      entrega: 'envio',
    },
  });
  assert.equal(order.status, 201);
  assert.match(order.data.initPoint, /^https:\/\/mp\.test/);
  const pref = preferences.at(-1);
  assert.equal(pref.external_reference, String(order.data.orderId));
  assert.equal(pref.notification_url, 'https://tienda.test/api/payments/webhook');
  assert.equal(pref.auto_return, 'approved');
  assert.equal(pref.shipments.cost, 5000);
  const cascabel = pref.items.find((i) => i.id === String(state.cascabel));
  assert.equal(cascabel.quantity, 3);
  state.order = order.data;

  const detail = await api('GET', `/api/orders/${order.data.orderId}?key=${order.data.accessKey}`);
  assert.equal(detail.data.total, 60000 + 24000 + 5000);
  assert.equal(detail.data.estado, 'pendiente');
  const noKey = await api('GET', `/api/orders/${order.data.orderId}?key=otra`);
  assert.equal(noKey.status, 404);

  payments.set('9001', {
    id: 9001, status: 'approved', status_detail: 'accredited', currency_id: 'ARS',
    transaction_amount: 89000, external_reference: String(order.data.orderId), payment_type_id: 'credit_card',
  });

  const unsigned = await api('POST', '/api/payments/webhook?data.id=9001&type=payment', { body: { type: 'payment', data: { id: '9001' } } });
  assert.equal(unsigned.status, 401);

  const ts = String(Date.now());
  const reqId = 'req-abc';
  const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`id:9001;request-id:${reqId};ts:${ts};`).digest('hex');
  const hook = await api('POST', '/api/payments/webhook?data.id=9001&type=payment', {
    body: { type: 'payment', data: { id: '9001' } },
    headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId },
  });
  assert.equal(hook.status, 200);

  const paid = await api('GET', `/api/orders/${order.data.orderId}?key=${order.data.accessKey}`);
  assert.equal(paid.data.estado, 'pagado');
  const orderEmails = () => emails.filter((e) => !/Bienvenido/.test(e.subject));
  assert.ok(await waitFor(() => orderEmails().length === 2), 'emails de pago aprobado');
  const toCustomer = orderEmails().find((e) => e.to[0] === 'ana@mail.com');
  const toOwner = orderEmails().find((e) => e.to[0] === 'duena@rascate.test');
  assert.match(toCustomer.subject, /Recibimos tu pago/);
  assert.match(toCustomer.html, /Pelota Cascabel/);
  assert.match(toOwner.subject, /Nueva venta/);
  assert.equal(toOwner.reply_to, 'ana@mail.com');
  const prod = await api('GET', `/api/products/${state.productId}`);
  assert.equal(prod.data.stock, 2);

  const again = await api('POST', '/api/payments/confirm', { body: { paymentId: '9001' } });
  assert.equal(again.data.estado, 'pagado');
  await new Promise((res) => setTimeout(res, 150));
  assert.equal(orderEmails().length, 2, 'no duplica emails');
  const prod2 = await api('GET', `/api/products/${state.productId}`);
  assert.equal(prod2.data.stock, 2);

  const mine = await api('GET', '/api/orders/mine', { token: state.token });
  assert.equal(mine.data.length, 1);
});

test('pago rechazado, reintento y monto incorrecto', async () => {
  const order = await api('POST', '/api/orders', {
    body: { items: [{ id: state.premium, cantidad: 1 }], cliente: { nombre: 'Invitado', email: 'inv@mail.com', telefono: '1122334455' }, entrega: 'retiro' },
  });
  assert.equal(order.status, 201);
  assert.equal(preferences.at(-1).shipments, undefined);
  const id = String(order.data.orderId);

  payments.set('9002', { id: 9002, status: 'rejected', status_detail: 'cc_rejected_other_reason', currency_id: 'ARS', transaction_amount: 95625, external_reference: id });
  const rej = await api('POST', '/api/payments/confirm', { body: { paymentId: '9002' } });
  assert.equal(rej.data.estado, 'rechazado');

  const retry = await api('POST', `/api/orders/${id}/pay`, { body: { key: order.data.accessKey } });
  assert.equal(retry.status, 200);
  assert.ok(retry.data.initPoint);

  payments.set('9003', { id: 9003, status: 'approved', currency_id: 'ARS', transaction_amount: 10, external_reference: id });
  const cheap = await api('POST', '/api/payments/confirm', { body: { paymentId: '9003' } });
  assert.equal(cheap.data.estado, 'pendiente');

  payments.set('9004', { id: 9004, status: 'approved', currency_id: 'ARS', transaction_amount: 95625, external_reference: id });
  const ok = await api('POST', '/api/payments/confirm', { body: { paymentId: '9004' } });
  assert.equal(ok.data.estado, 'pagado');

  const late = await api('POST', '/api/payments/confirm', { body: { paymentId: '9002' } });
  assert.equal(late.data.estado, 'pagado');
});

test('admin: estadísticas, pedidos, usuarios', async () => {
  const stats = await api('GET', '/api/admin/stats', { token: state.admin });
  assert.equal(stats.data.pedidosPagados, 2);
  assert.equal(stats.data.ventasTotal, 89000 + 95625);
  assert.equal(stats.data.usuarios, 1);

  const cancel = await api('PATCH', `/api/admin/orders/${state.order.orderId}`, { token: state.admin, body: { estado: 'cancelado' } });
  assert.equal(cancel.data.estado, 'cancelado');
  assert.ok(await waitFor(() => emails.some((e) => /cancelado/.test(e.subject))), 'email de cancelación');
  const prod = await api('GET', `/api/products/${state.productId}`);
  assert.equal(prod.data.stock, 3);

  const users = await api('GET', '/api/admin/users', { token: state.admin });
  assert.equal(users.data.length, 2);
  const self = users.data.find((u) => u.rol === 'admin');
  const demote = await api('PATCH', `/api/admin/users/${self.id}`, { token: state.admin, body: { rol: 'cliente' } });
  assert.equal(demote.status, 400);

  const del = await api('DELETE', `/api/admin/products/${state.productId}`, { token: state.admin });
  assert.equal(del.status, 204);
  const orders = await api('GET', '/api/admin/orders', { token: state.admin });
  assert.equal(orders.data.length, 2);
  assert.equal(orders.data.find((o) => o.id === state.order.orderId).items[0].nombre, 'Rascador Test');
});

test('rutas desconocidas y SPA', async () => {
  const r = await api('GET', '/api/nada');
  assert.equal(r.status, 404);
  const m = await api('DELETE', '/api/products');
  assert.equal(m.status, 405);
  const page = await fetch(BASE + '/mi-cuenta');
  assert.equal(page.status, 200);
});
