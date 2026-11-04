import { config } from './config.js';

const { mail } = config;

export const mailEnabled = () => Boolean(mail.from && (mail.resendKey || mail.brevoKey));

function parseAddress(value) {
  const m = String(value).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, ''), email: m[2] } : { name: 'Rascate Art', email: String(value).trim() };
}

async function post(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Email ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function sendMail({ to, subject, html, replyTo }) {
  if (!mailEnabled() || !to) return false;
  const reply = replyTo || mail.replyTo;
  if (mail.resendKey) {
    await post(
      `${mail.apiUrl || 'https://api.resend.com'}/emails`,
      { Authorization: `Bearer ${mail.resendKey}` },
      { from: mail.from, to: [to], subject, html, ...(reply ? { reply_to: reply } : {}) }
    );
  } else {
    await post(
      `${mail.apiUrl || 'https://api.brevo.com'}/v3/smtp/email`,
      { 'api-key': mail.brevoKey },
      { sender: parseAddress(mail.from), to: [{ email: to }], subject, htmlContent: html, ...(reply ? { replyTo: { email: reply } } : {}) }
    );
  }
  return true;
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function layout(title, intro, order, items, extra = '') {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #ece6e1">${esc(i.nombre)} <span style="color:#6b6265">× ${i.cantidad}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #ece6e1;text-align:right;white-space:nowrap">${money(i.precio_unitario * i.cantidad)}</td>
      </tr>`
    )
    .join('');
  const envio = order.entrega === 'retiro' ? 'Retiro' : order.envio ? money(order.envio) : 'A coordinar';
  const entrega = order.entrega === 'retiro' ? 'Retiro coordinado por WhatsApp' : `Envío a ${esc(order.direccion)}`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f7f3ef;font-family:Arial,Helvetica,sans-serif;color:#211c1e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ef;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2dad4;border-radius:8px">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #ece6e1">
          <a href="${esc(config.publicUrl)}" style="color:#211c1e;text-decoration:none;font-family:Georgia,serif;font-size:22px">Rascate Art</a>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2">${esc(title)}</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.5">${intro}</p>
          ${extra}
          <p style="margin:0 0 8px;font-size:12px;color:#6b6265;text-transform:uppercase;letter-spacing:.04em">Pedido #${order.id}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">
            ${rows}
            <tr><td style="padding:8px 0;color:#6b6265">Envío</td><td style="padding:8px 0;text-align:right;color:#6b6265">${envio}</td></tr>
            <tr><td style="padding:12px 0 0;font-size:17px"><strong>Total</strong></td><td style="padding:12px 0 0;text-align:right;font-size:17px"><strong>${money(order.total)}</strong></td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:14px;color:#6b6265;line-height:1.5">${entrega}</p>
          <p style="margin:24px 0 0"><a href="${esc(config.publicUrl)}${order.user_id ? '/mi-cuenta' : '/'}" style="display:inline-block;background:#a3335f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px">${order.user_id ? 'Ver mis pedidos' : 'Visitar la tienda'}</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #ece6e1;font-size:12px;color:#6b6265">
          Si tenés dudas, respondé este email. Rascate Art · Exclusividad y confort para tu gato.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export async function sendWelcomeEmail(user) {
  if (!mailEnabled()) return;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f7f3ef;font-family:Arial,Helvetica,sans-serif;color:#211c1e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ef;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2dad4;border-radius:8px">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #ece6e1">
          <a href="${esc(config.publicUrl)}" style="color:#211c1e;text-decoration:none;font-family:Georgia,serif;font-size:22px">Rascate Art</a>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.2">¡Bienvenido/a, ${esc(String(user.nombre).split(' ')[0])}!</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.5">Tu cuenta en Rascate Art ya está lista. Desde ahí vas a poder seguir tus pedidos y comprar más rápido, con tus datos de envío guardados.</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b6265;line-height:1.5">Ingresás con este email: <strong style="color:#211c1e">${esc(user.email)}</strong></p>
          <p style="margin:0"><a href="${esc(config.publicUrl)}/" style="display:inline-block;background:#a3335f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px">Ver el catálogo</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #ece6e1;font-size:12px;color:#6b6265">
          Si no creaste esta cuenta, respondé este email y lo revisamos.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
  try {
    await sendMail({ to: user.email, subject: 'Bienvenido/a a Rascate Art', html });
  } catch (err) {
    console.error(`No se pudo enviar el email de bienvenida a ${user.email}:`, err.message);
  }
}

const nombre = (o) => esc(String(o.nombre).split(' ')[0]);

const CUSTOMER = {
  pagado: (o) => ({
    subject: `Recibimos tu pago · Pedido #${o.id}`,
    title: '¡Gracias por tu compra!',
    intro: `Hola ${nombre(o)}, recibimos tu pago. En breve te escribimos para coordinar la entrega.`,
  }),
  en_preparacion: (o) => ({
    subject: `Estamos preparando tu pedido #${o.id}`,
    title: 'Estamos preparando tu pedido',
    intro: `Hola ${nombre(o)}, ya estamos armando tu pedido. Te avisamos cuando salga.`,
  }),
  enviado: (o) => ({
    subject: `Tu pedido #${o.id} está en camino`,
    title: 'Tu pedido está en camino',
    intro:
      o.entrega === 'retiro'
        ? `Hola ${nombre(o)}, tu pedido está listo para retirar. Te escribimos para coordinar día y horario.`
        : `Hola ${nombre(o)}, tu pedido ya salió y va camino a tu casa.`,
  }),
  entregado: (o) => ({
    subject: `Tu pedido #${o.id} fue entregado`,
    title: '¡Que lo disfrute tu gato!',
    intro: `Hola ${nombre(o)}, tu pedido figura como entregado. Gracias por elegir Rascate Art.`,
  }),
  cancelado: (o) => ({
    subject: `Tu pedido #${o.id} fue cancelado`,
    title: 'Cancelamos tu pedido',
    intro: `Hola ${nombre(o)}, tu pedido fue cancelado. Si ya lo habías pagado, el reintegro se hace por Mercado Pago al mismo medio de pago.`,
  }),
};

export async function sendOrderEmails(order, items, prevEstado) {
  if (!mailEnabled() || order.estado === prevEstado) return;
  const jobs = [];
  const template = CUSTOMER[order.estado];
  if (template) {
    const t = template(order);
    jobs.push(sendMail({ to: order.email, subject: t.subject, html: layout(t.title, t.intro, order, items) }));
  }
  if (order.estado === 'pagado' && mail.notify) {
    const extra = `<p style="margin:0 0 24px;font-size:15px;line-height:1.6">
      <strong>${esc(order.nombre)}</strong><br>${esc(order.email)} · ${esc(order.telefono)}
      ${order.notas ? `<br><span style="color:#6b6265">Notas: ${esc(order.notas)}</span>` : ''}</p>`;
    jobs.push(
      sendMail({
        to: mail.notify,
        replyTo: order.email,
        subject: `Nueva venta · Pedido #${order.id} · ${money(order.total)}`,
        html: layout(`Nueva venta: ${money(order.total)}`, 'Entró un pedido pagado con Mercado Pago.', order, items, extra).replace(/href="[^"]*" style="display:inline-block[^"]*">[^<]*</, (m) =>
          m.replace(/href="[^"]*"/, `href="${esc(config.publicUrl)}/admin/pedidos"`).replace(/>[^<]*<$/, '>Abrir el panel<')
        ),
      })
    );
  }
  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === 'rejected') console.error(`No se pudo enviar email del pedido ${order.id}:`, r.reason.message);
}
