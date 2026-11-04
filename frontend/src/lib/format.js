const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export const formatMoney = (n) => money.format(Number(n) || 0)

export const formatDate = (s) => {
  if (!s) return ''
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const ESTADOS = {
  pendiente: { label: 'Pendiente de pago', color: 'gold' },
  pagado: { label: 'Pagado', color: 'green' },
  rechazado: { label: 'Pago rechazado', color: 'red' },
  en_preparacion: { label: 'En preparación', color: 'blue' },
  enviado: { label: 'Enviado', color: 'geekblue' },
  entregado: { label: 'Entregado', color: 'cyan' },
  cancelado: { label: 'Cancelado', color: 'default' },
}

export const PAYMENT_TYPES = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  prepaid_card: 'Tarjeta prepaga',
  account_money: 'Dinero en cuenta MP',
  ticket: 'Efectivo (Rapipago / Pago Fácil)',
  bank_transfer: 'Transferencia',
  digital_currency: 'Cuotas sin tarjeta',
  atm: 'Cajero automático',
}

export const whatsappLink = (phone, text = '') => {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (!digits.startsWith('54')) digits = '549' + digits.replace(/^0/, '').replace(/^(\d{2,4})15/, '$1')
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
