import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, 'backend', '.env'));

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const dataDir = path.resolve(ROOT, env.DATA_DIR || 'backend/data');

let jwtSecret = env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) throw new Error('JWT_SECRET es obligatorio en producción');
  jwtSecret = crypto.randomBytes(32).toString('hex');
}

export const config = {
  isProd,
  port: Number(env.PORT) || 3000,
  publicUrl: (env.PUBLIC_URL || `http://localhost:${Number(env.PORT) || 3000}`).replace(/\/$/, ''),
  corsOrigin: env.CORS_ORIGIN || '',
  dataDir,
  dbFile: path.join(dataDir, 'rascate.db'),
  uploadsDir: path.join(dataDir, 'uploads'),
  distDir: path.join(ROOT, 'frontend', 'dist'),
  jwtSecret,
  adminEmail: (env.ADMIN_EMAIL || '').toLowerCase().trim(),
  adminPassword: env.ADMIN_PASSWORD || '',
  mp: {
    accessToken: env.MP_ACCESS_TOKEN || '',
    webhookSecret: env.MP_WEBHOOK_SECRET || '',
    apiUrl: (env.MP_API_URL || 'https://api.mercadopago.com').replace(/\/$/, ''),
    statementDescriptor: env.MP_STATEMENT_DESCRIPTOR || 'RASCATE ART',
  },
  mail: {
    from: env.MAIL_FROM || '',
    notify: env.MAIL_NOTIFY || '',
    replyTo: env.MAIL_REPLY_TO || '',
    resendKey: env.RESEND_API_KEY || '',
    brevoKey: env.BREVO_API_KEY || '',
    apiUrl: (env.MAIL_API_URL || '').replace(/\/$/, ''),
  },
  shipping: {
    cost: Number(env.SHIPPING_COST) || 0,
    freeFrom: Number(env.FREE_SHIPPING_FROM) || 0,
  },
};

fs.mkdirSync(config.uploadsDir, { recursive: true });
