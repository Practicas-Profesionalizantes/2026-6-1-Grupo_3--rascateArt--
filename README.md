# Rascate Art

Tienda online de Rascate Art: catálogo, carrito, checkout con **Mercado Pago (Checkout Pro)**, cuentas de clientes y panel de administración.

- `frontend/`: React 19 + Vite + Ant Design.
- `backend/`: Node.js 22 sin dependencias externas (HTTP nativo, SQLite integrado `node:sqlite`, JWT propio, API REST de Mercado Pago).
- En producción el backend sirve también el frontend compilado: **un solo servicio, un solo dominio**.

## Requisitos

- Node.js **22.13 o superior** (o Docker).
- Una cuenta de Mercado Pago con credenciales de producción (o de prueba para testear).

## Desarrollo local

```bash
cp .env.example .env          # completar MP_ACCESS_TOKEN, ADMIN_EMAIL, ADMIN_PASSWORD
# en .env para local: NODE_ENV=development y PUBLIC_URL=http://localhost:5173
npm ci --prefix frontend
npm run dev                   # API en http://localhost:3000
npm run dev:web               # Frontend en http://localhost:5173 (proxy a la API)
npm test                      # tests de la API (simulan Mercado Pago)
```

Al iniciar por primera vez se crea la base `backend/data/rascate.db`, se carga el catálogo inicial y se crea el usuario administrador definido en `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PUBLIC_URL` | Sí | URL pública con `https`, sin barra final. Se usa para las URLs de retorno y el webhook de Mercado Pago. |
| `JWT_SECRET` | Sí | Cadena larga y aleatoria para firmar sesiones. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Sí (primer arranque) | Crea (o promueve) la cuenta administradora. |
| `MP_ACCESS_TOKEN` | Sí | Access Token de Mercado Pago (`APP_USR-...`). Sin esto el checkout queda deshabilitado. |
| `MP_WEBHOOK_SECRET` | Recomendada | Clave secreta de webhooks para validar la firma de las notificaciones. |
| `MP_STATEMENT_DESCRIPTOR` | No | Texto que aparece en el resumen de la tarjeta. |
| `MAIL_FROM` | Para emails | Remitente, por ejemplo `Rascate Art <pedidos@tu-dominio.com>`. |
| `RESEND_API_KEY` o `BREVO_API_KEY` | Para emails | Clave del proveedor de email (uno de los dos). |
| `MAIL_NOTIFY` | No | Email donde te llega el aviso de cada venta nueva. |
| `MAIL_REPLY_TO` | No | Adónde llegan las respuestas de los clientes. |
| `SHIPPING_COST` | No | Costo fijo de envío en ARS. `0` = "a coordinar". |
| `FREE_SHIPPING_FROM` | No | Monto desde el que el envío es gratis. `0` = desactivado. |
| `DATA_DIR` | No | Carpeta para la base de datos y las imágenes subidas. En Docker: `/data`. |
| `CORS_ORIGIN` | No | Solo si el frontend se publica en otro dominio (lista separada por comas). |
| `PORT` | No | Puerto HTTP (por defecto `3000`). |

## Deploy

La base de datos y las imágenes que se suben desde el panel viven en `DATA_DIR`. **Esa carpeta tiene que estar en un disco/volumen persistente**, si no se pierden en cada deploy.

### Opción A: Docker (Railway, Render, Fly.io, VPS)

```bash
docker build -t rascate-art .
docker run -d -p 3000:3000 -v rascate-data:/data --env-file .env rascate-art
```

- **Railway**: nuevo proyecto desde el repo (detecta el `Dockerfile`), agregar un Volume montado en `/data` y cargar las variables.
- **Render**: el archivo `render.yaml` ya define el servicio Docker con un disco en `/data` (los discos requieren plan pago). Completar `PUBLIC_URL`, `ADMIN_*` y `MP_*` en el panel.
- **VPS**: el comando de arriba detrás de Nginx/Caddy con HTTPS.

### Opción B: Node directo

```bash
npm run build     # instala y compila el frontend
npm start         # levanta API + frontend en PORT
```

## Mercado Pago

1. Entrá a [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app), creá una aplicación (Checkout Pro) y copiá el **Access Token de producción** en `MP_ACCESS_TOKEN`.
2. En la aplicación → **Webhooks** → configurar la URL `https://TU-DOMINIO/api/payments/webhook`, evento **Pagos**. Copiá la **clave secreta** en `MP_WEBHOOK_SECRET`.
3. Listo: el cliente paga en Mercado Pago (tarjeta de crédito/débito, dinero en cuenta, Rapipago/Pago Fácil) y vuelve a `/pago/resultado`.

Cómo se confirma un pago:

- El servidor calcula precios y totales (el navegador nunca define montos).
- Cada notificación o retorno se verifica consultando el pago directamente a la API de Mercado Pago; se valida moneda y monto.
- Al aprobarse, el pedido pasa a **Pagado** y se descuenta stock (una sola vez). Si se cancela un pedido pagado, el stock vuelve.
- Si el pago es rechazado, el cliente puede reintentarlo desde la pantalla de resultado o desde "Mis pedidos".

**Para probar**: usá las credenciales de una cuenta de prueba (vendedor) y pagá con un comprador de prueba y las [tarjetas de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards). Con `PUBLIC_URL` en `http://localhost` Mercado Pago no puede notificar al webhook, pero el estado igual se confirma cuando el cliente vuelve al sitio.

## Emails automáticos

La tienda manda un email de bienvenida al crear una cuenta, y emails al cliente cuando se aprueba el pago y cuando el pedido pasa a **En preparación**, **Enviado**, **Entregado** o **Cancelado**. Además te avisa a `MAIL_NOTIFY` de cada venta nueva. Sin proveedor configurado la tienda funciona igual, pero no manda emails.

Elegí un proveedor:

- **Resend** (recomendado si tenés dominio propio): creá una cuenta en resend.com, verificá tu dominio (te da registros DNS para cargar en Hostinger), creá una API key y cargala en `RESEND_API_KEY`. `MAIL_FROM` tiene que usar ese dominio.
- **Brevo** (sin dominio propio): creá una cuenta en brevo.com, verificá un remitente en *Senders*, generá una API key en *SMTP & API* y cargala en `BREVO_API_KEY`. `MAIL_FROM` tiene que ser el remitente verificado.

## Panel de administración

Entrá en `/admin` con la cuenta administradora:

- **Resumen**: ventas del mes, pedidos pagados, clientes, más vendidos.
- **Productos**: alta, edición, baja, subida de imágenes, descuentos, stock (vacío = a pedido), visibilidad y destacados.
- **Pedidos**: filtro por estado, detalle del pago, cambio de estado (en preparación, enviado, entregado, cancelado) y contacto directo por WhatsApp o email.
- **Clientes**: compras por cliente y asignación de rol administrador.

## API

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/products`, `/api/products/:id`, `/api/config` | Público |
| POST | `/api/auth/register`, `/api/auth/login` | Público |
| GET/PUT | `/api/auth/me` | Usuario |
| POST | `/api/orders` | Público (invitado o usuario) |
| GET | `/api/orders/mine` | Usuario |
| GET | `/api/orders/:id?key=` | Dueño del pedido |
| POST | `/api/orders/:id/pay` | Dueño del pedido |
| POST | `/api/payments/confirm`, `/api/payments/webhook` | Mercado Pago / retorno |
| GET/POST/PUT/DELETE | `/api/admin/products` | Admin |
| POST | `/api/admin/uploads` | Admin (imagen en el body, máx. 5 MB) |
| GET/PATCH | `/api/admin/orders`, `/api/admin/users` | Admin |
| GET | `/api/admin/stats` | Admin |
