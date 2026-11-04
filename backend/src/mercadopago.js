import crypto from 'node:crypto';
import { config } from './config.js';
import { HttpError } from './http.js';

export const mpEnabled = () => Boolean(config.mp.accessToken);

async function mpFetch(pathname, options = {}) {
  if (!mpEnabled()) throw new HttpError(503, 'Mercado Pago no está configurado');
  const res = await fetch(`${config.mp.apiUrl}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.mp.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    console.error(`Mercado Pago ${res.status} en ${pathname}:`, data);
    throw new HttpError(502, 'No se pudo comunicar con Mercado Pago', data?.message);
  }
  return data;
}

export async function createPreference(order, items) {
  const isHttps = config.publicUrl.startsWith('https://');
  const resultUrl = `${config.publicUrl}/pago/resultado`;
  const body = {
    items: items.map((i) => ({
      id: String(i.product_id),
      title: i.nombre,
      quantity: i.cantidad,
      unit_price: i.precio_unitario,
      currency_id: 'ARS',
    })),
    payer: { name: order.nombre, email: order.email },
    external_reference: String(order.id),
    metadata: { order_id: order.id },
    statement_descriptor: config.mp.statementDescriptor,
    back_urls: { success: resultUrl, failure: resultUrl, pending: resultUrl },
  };
  if (order.envio > 0) {
    body.shipments = { cost: order.envio, mode: 'not_specified' };
  }
  if (isHttps) {
    body.auto_return = 'approved';
    body.notification_url = `${config.publicUrl}/api/payments/webhook`;
  }
  return mpFetch('/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `order-${order.id}-${order.access_key}` },
    body: JSON.stringify(body),
  });
}

export const getPayment = (id) => mpFetch(`/v1/payments/${encodeURIComponent(id)}`);

export function verifyWebhookSignature(req, dataId) {
  if (!config.mp.webhookSecret) return true;
  const header = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  if (!header) return false;
  const parts = Object.fromEntries(
    String(header)
      .split(',')
      .map((p) => p.trim().split('='))
      .filter((p) => p.length === 2)
  );
  if (!parts.ts || !parts.v1) return false;
  let manifest = '';
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', config.mp.webhookSecret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(parts.v1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
