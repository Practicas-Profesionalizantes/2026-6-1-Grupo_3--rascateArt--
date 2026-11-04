import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { hashPassword } from './auth.js';

export const db = new DatabaseSync(config.dbFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    telefono TEXT NOT NULL DEFAULT '',
    direccion TEXT NOT NULL DEFAULT '',
    rol TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    precio INTEGER NOT NULL CHECK (precio >= 0),
    descuento INTEGER NOT NULL DEFAULT 0 CHECK (descuento BETWEEN 0 AND 90),
    coleccion TEXT NOT NULL,
    stock INTEGER,
    imagen TEXT NOT NULL DEFAULT '',
    activo INTEGER NOT NULL DEFAULT 1,
    destacado INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    access_key TEXT NOT NULL,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT NOT NULL,
    entrega TEXT NOT NULL CHECK (entrega IN ('envio', 'retiro')),
    direccion TEXT NOT NULL DEFAULT '',
    notas TEXT NOT NULL DEFAULT '',
    subtotal INTEGER NOT NULL,
    envio INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    mp_preference_id TEXT,
    mp_payment_id TEXT,
    mp_status TEXT,
    mp_status_detail TEXT,
    mp_payment_type TEXT,
    stock_descontado INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    precio_unitario INTEGER NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`);

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seedProducts() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM products').get();
  if (n > 0) return;
  const seed = JSON.parse(fs.readFileSync(new URL('./seed-products.json', import.meta.url), 'utf8'));
  const insert = db.prepare(
    'INSERT INTO products (nombre, descripcion, precio, descuento, coleccion, imagen) VALUES (?, ?, ?, ?, ?, ?)'
  );
  tx(() => seed.forEach((p) => insert.run(p.nombre, p.descripcion, p.precio, p.descuento, p.coleccion, p.imagen)));
  console.log(`Catálogo inicial cargado (${seed.length} productos)`);
}

function seedAdmin() {
  if (!config.adminEmail || !config.adminPassword) return;
  const existing = db.prepare('SELECT id, rol FROM users WHERE email = ?').get(config.adminEmail);
  if (existing) {
    if (existing.rol !== 'admin') db.prepare("UPDATE users SET rol = 'admin' WHERE id = ?").run(existing.id);
    return;
  }
  db.prepare("INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, 'admin')").run(
    'Administrador',
    config.adminEmail,
    hashPassword(config.adminPassword)
  );
  console.log(`Usuario admin creado: ${config.adminEmail}`);
}

seedProducts();
seedAdmin();
