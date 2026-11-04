import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { HttpError, send, serveFile } from './http.js';
import { router, loadUser } from './routes.js';
import { mpEnabled } from './mercadopago.js';
import { mailEnabled } from './mailer.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || !config.corsOrigin) return;
  const allowed = config.corsOrigin.split(',').map((s) => s.trim());
  if (allowed.includes('*') || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
}

async function handleApi(req, res, url) {
  const match = router.match(req.method, url.pathname);
  if (!match) return send(res, 404, { error: 'Ruta no encontrada' });
  if (match === 'method') return send(res, 405, { error: 'Método no permitido' });

  const ctx = { req, res, params: match.params, query: url.searchParams, status: 200, user: null };
  loadUser(ctx);
  let result;
  for (const handler of match.handlers) result = await handler(ctx);
  if (ctx.status === 204) {
    res.writeHead(204);
    return res.end();
  }
  send(res, ctx.status, result ?? {});
}

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://localhost');

  try {
    if (url.pathname.startsWith('/api/')) {
      applyCors(req, res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
      return await handleApi(req, res, url);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Método no permitido' });

    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/uploads/')) {
      if (serveFile(req, res, config.uploadsDir, pathname.slice('/uploads'.length), { immutable: true })) return;
      return send(res, 404, { error: 'Archivo no encontrado' });
    }

    if (pathname !== '/' && serveFile(req, res, config.distDir, pathname, { immutable: pathname.startsWith('/assets/') })) return;
    if (path.extname(pathname) && pathname !== '/') return send(res, 404, { error: 'Archivo no encontrado' });
    if (serveFile(req, res, config.distDir, '/index.html')) return;
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('API de Rascate Art funcionando. Ejecutá "npm run build" para generar el frontend.');
  } catch (err) {
    if (err instanceof HttpError) {
      return send(res, err.status, { error: err.message, ...(err.details && !config.isProd ? { details: err.details } : {}) });
    }
    console.error(err);
    send(res, 500, { error: 'Error interno del servidor' });
  }
});

server.listen(config.port, () => {
  console.log(`Rascate Art escuchando en el puerto ${config.port} (${config.publicUrl})`);
  if (config.isProd && !process.env.PUBLIC_URL) console.warn('Atención: definí PUBLIC_URL con la URL pública (https) del sitio para que Mercado Pago pueda volver y notificar pagos.');
  if (!mailEnabled()) console.warn('Atención: no hay proveedor de email configurado, no se van a enviar emails a los clientes.');
  if (!mpEnabled()) console.warn('Atención: MP_ACCESS_TOKEN no está configurado, los pagos están deshabilitados.');
  if (!fs.existsSync(config.distDir)) console.warn('Atención: no se encontró frontend/dist. Ejecutá "npm run build".');
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
