import { useEffect, useState } from 'react'
import { Button, Radio, Result, Spin } from 'antd'
import { CreditCardOutlined, WalletOutlined, ShopOutlined } from '@ant-design/icons'
import { api } from '../lib/api'
import { navigate } from '../lib/router'
import { formatMoney } from '../lib/format'

const METODOS = [
  { value: 'credit_card', label: 'Tarjeta de crédito', icon: <CreditCardOutlined /> },
  { value: 'account_money', label: 'Dinero en cuenta', icon: <WalletOutlined /> },
  { value: 'ticket', label: 'Efectivo (Rapipago / Pago Fácil)', icon: <ShopOutlined /> },
]

export default function MercadoPagoDemoPage({ params }) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(false)
  const [metodo, setMetodo] = useState('credit_card')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api(`/api/orders/${params.id}`).then(setOrder).catch(() => setError(true))
  }, [params.id])

  const pay = async (status) => {
    setBusy(true)
    const finalStatus = metodo === 'ticket' && status === 'approved' ? 'pending' : status
    const r = await api('/api/demo/pay', { method: 'POST', body: { orderId: params.id, status: finalStatus, type: metodo } })
    navigate(`/pago/resultado?payment_id=${r.paymentId}&status=${finalStatus}&external_reference=${params.id}`, { replace: true })
  }

  if (error) return <Result status="404" title="Pedido no encontrado" />
  if (!order) {
    return (
      <div className="page-loader">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="mp-demo">
      <div className="mp-demo-card">
        <div className="mp-demo-head">
          <strong>mercado pago</strong>
          <span>Simulación</span>
        </div>
        <div className="mp-demo-body">
          <p className="mp-demo-label">Pagás a Rascate Art</p>
          <p className="mp-demo-amount">{formatMoney(order.total)}</p>
          <p className="mp-demo-label">Pedido #{order.id}</p>
          <Radio.Group value={metodo} onChange={(e) => setMetodo(e.target.value)} className="mp-demo-methods">
            {METODOS.map((m) => (
              <Radio key={m.value} value={m.value}>
                {m.icon} {m.label}
              </Radio>
            ))}
          </Radio.Group>
          <Button type="primary" size="large" block loading={busy} onClick={() => pay('approved')} className="mp-demo-pay">
            {metodo === 'ticket' ? 'Generar cupón de pago' : 'Pagar'}
          </Button>
          <Button size="large" block disabled={busy} onClick={() => pay('rejected')}>
            Simular pago rechazado
          </Button>
          <p className="mp-demo-note">
            Esta pantalla reemplaza a Mercado Pago solo en la demo. En el sitio real acá se abre el checkout de Mercado Pago.
          </p>
        </div>
      </div>
    </div>
  )
}
