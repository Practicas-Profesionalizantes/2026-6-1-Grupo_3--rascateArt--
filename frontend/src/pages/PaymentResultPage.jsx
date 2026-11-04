import { useEffect, useState } from 'react'
import { App, Button, Result, Spin } from 'antd'
import { api, PENDING_ORDER_KEY, redirectTo } from '../lib/api'
import { navigate, useLocation } from '../lib/router'
import { formatMoney, PAYMENT_TYPES } from '../lib/format'
import { useShop } from '../context/ShopContext'
import { useAuth } from '../context/AuthContext'

const readPending = () => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_ORDER_KEY) || 'null')
  } catch {
    return null
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default function PaymentResultPage() {
  const { message } = App.useApp()
  const { search } = useLocation()
  const { clearCart } = useShop()
  const { user, ready } = useAuth()
  const [order, setOrder] = useState(null)
  const [estado, setEstado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const paymentId = search.get('payment_id') || search.get('collection_id')
  const mpStatus = search.get('status') || search.get('collection_status')
  const pending = readPending()
  const orderId = search.get('external_reference') || pending?.orderId
  const key = pending && String(pending.orderId) === String(orderId) ? pending.accessKey : null

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    const fetchOrder = async () => {
      if (!orderId || (!key && !user)) return null
      return api(`/api/orders/${orderId}${key ? `?key=${encodeURIComponent(key)}` : ''}`).catch(() => null)
    }

    ;(async () => {
      let current = null
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        if (paymentId && /^\d+$/.test(paymentId)) {
          const r = await api('/api/payments/confirm', { method: 'POST', body: { paymentId } }).catch(() => null)
          if (r) current = r.estado
        }
        const o = await fetchOrder()
        if (o) {
          current = o.estado
          if (!cancelled) setOrder(o)
        }
        if (current !== 'pendiente' || mpStatus !== 'approved') break
        await sleep(2500)
      }
      if (cancelled) return
      const final = current || (mpStatus === 'approved' ? 'pagado' : mpStatus === 'rejected' ? 'rechazado' : mpStatus === 'null' ? 'rechazado' : 'pendiente')
      setEstado(final)
      setLoading(false)
      if (final === 'pagado' || mpStatus === 'pending' || mpStatus === 'in_process') clearCart()
      if (final === 'pagado') {
        try {
          localStorage.removeItem(PENDING_ORDER_KEY)
        } catch {
          /* almacenamiento no disponible */
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [ready, paymentId, mpStatus, orderId, key, user, clearCart])

  const retry = async () => {
    setRetrying(true)
    try {
      const r = await api(`/api/orders/${orderId}/pay`, { method: 'POST', body: { key } })
      redirectTo(r.initPoint)
    } catch (e) {
      message.error(e.message)
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <div className="container narrow center page-loader">
        <Spin size="large" />
        <p className="muted mt">Confirmando tu pago con Mercado Pago…</p>
      </div>
    )
  }

  const details = order && (
    <div className="result-details">
      <div>
        <span className="muted">Pedido</span>
        <strong>#{order.id}</strong>
      </div>
      <div>
        <span className="muted">Total</span>
        <strong>{formatMoney(order.total)}</strong>
      </div>
      {order.mpPaymentType && (
        <div>
          <span className="muted">Medio de pago</span>
          <strong>{PAYMENT_TYPES[order.mpPaymentType] || order.mpPaymentType}</strong>
        </div>
      )}
    </div>
  )

  const goAccount = user ? (
    <Button key="cuenta" onClick={() => navigate('/mi-cuenta')}>
      Ver mis pedidos
    </Button>
  ) : null
  const goShop = (
    <Button key="tienda" type={estado === 'pagado' ? 'primary' : 'default'} onClick={() => navigate('/')}>
      Volver a la tienda
    </Button>
  )

  if (estado === 'pagado' || ['en_preparacion', 'enviado', 'entregado'].includes(estado)) {
    return (
      <div className="container narrow">
        <Result
          status="success"
          title="¡Gracias por tu compra!"
          subTitle={`Recibimos tu pago. Te escribimos${order ? ` a ${order.email}` : ''} para coordinar la entrega.`}
          extra={[goShop, goAccount]}
        >
          {details}
        </Result>
      </div>
    )
  }

  if (estado === 'rechazado' || estado === 'cancelado') {
    return (
      <div className="container narrow">
        <Result
          status="error"
          title="El pago no se pudo completar"
          subTitle="No se realizó ningún cobro. Podés intentar de nuevo con otro medio de pago."
          extra={[
            orderId && (key || user) && estado === 'rechazado' ? (
              <Button key="retry" type="primary" loading={retrying} onClick={retry}>
                Reintentar pago
              </Button>
            ) : null,
            <Button key="checkout" onClick={() => navigate('/checkout')}>
              Volver al checkout
            </Button>,
          ]}
        >
          {details}
        </Result>
      </div>
    )
  }

  return (
    <div className="container narrow">
      <Result
        status="info"
        title="Tu pago está pendiente"
        subTitle={
          mpStatus === 'pending' || mpStatus === 'in_process'
            ? 'Si elegiste pagar en efectivo, tenés que acercarte a abonar con el comprobante. Te avisamos cuando se acredite.'
            : 'Todavía no recibimos la confirmación del pago. Si ya pagaste, en unos minutos se va a acreditar.'
        }
        extra={[
          orderId && (key || user) && !['pending', 'in_process'].includes(mpStatus) ? (
            <Button key="retry" type="primary" loading={retrying} onClick={retry}>
              Pagar ahora
            </Button>
          ) : null,
          goAccount,
          goShop,
        ]}
      >
        {details}
      </Result>
    </div>
  )
}
