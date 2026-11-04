import { useEffect, useState } from 'react'
import { App, Button, Collapse, Form, Input, Skeleton } from 'antd'
import EmptyState from '../components/EmptyState'
import { blurValidation } from '../lib/forms'
import { api, redirectTo } from '../lib/api'
import { navigate } from '../lib/router'
import { formatDate, formatMoney } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import OrderStatusTag from '../components/OrderStatusTag'

function OrderList() {
  const { message } = App.useApp()
  const [orders, setOrders] = useState(null)
  const [paying, setPaying] = useState(null)

  useEffect(() => {
    api('/api/orders/mine')
      .then(setOrders)
      .catch((e) => {
        message.error(e.message)
        setOrders([])
      })
  }, [message])

  const pay = async (id) => {
    setPaying(id)
    try {
      const r = await api(`/api/orders/${id}/pay`, { method: 'POST', body: {} })
      redirectTo(r.initPoint)
    } catch (e) {
      message.error(e.message)
      setPaying(null)
    }
  }

  if (!orders) return <Skeleton active />
  if (orders.length === 0) {
    return (
      <EmptyState
        compact
        title="Todavía no hiciste pedidos"
        text="Cuando compres algo, lo vas a poder seguir desde acá."
        action={<Button type="primary" onClick={() => navigate('/')}>Ver el catálogo</Button>}
      />
    )
  }

  return (
    <Collapse
      className="orders-collapse"
      items={orders.map((o) => ({
        key: o.id,
        label: (
          <div className="order-row">
            <strong>Pedido #{o.id}</strong>
            <span className="muted">{formatDate(o.createdAt)}</span>
            <OrderStatusTag estado={o.estado} />
            <strong className="order-row-total">{formatMoney(o.total)}</strong>
          </div>
        ),
        children: (
          <div>
            <ul className="summary-list compact">
              {o.items.map((i, idx) => (
                <li key={idx}>
                  <span className="summary-name">
                    {i.nombre} <small className="muted">× {i.cantidad}</small>
                  </span>
                  <span>{formatMoney(i.precio * i.cantidad)}</span>
                </li>
              ))}
            </ul>
            <div className="summary-row">
              <span>Envío</span>
              <span>{o.entrega === 'retiro' ? 'Retiro' : o.envio ? formatMoney(o.envio) : 'A coordinar'}</span>
            </div>
            {o.entrega === 'envio' && <p className="muted small">Enviar a: {o.direccion}</p>}
            {['pendiente', 'rechazado'].includes(o.estado) && (
              <Button type="primary" loading={paying === o.id} onClick={() => pay(o.id)}>
                Pagar con Mercado Pago
              </Button>
            )}
          </div>
        ),
      }))}
    />
  )
}

export default function AccountPage() {
  const { message } = App.useApp()
  const { user, ready, updateProfile, logout } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (ready && !user) navigate('/ingresar?next=/mi-cuenta', { replace: true })
  }, [ready, user])

  if (!user) return null

  const save = async (values) => {
    setSaving(true)
    try {
      await updateProfile(values)
      message.success('Datos actualizados')
    } catch (e) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container">
      <div className="account-head">
        <h1 className="page-title">Hola, {user.nombre.split(' ')[0]}</h1>
        <div className="account-actions">
          {user.rol === 'admin' && <Button onClick={() => navigate('/admin')}>Panel de administración</Button>}
          <Button
            danger
            onClick={() => {
              logout()
              navigate('/')
            }}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>
      <div className="account">
        <section className="panel">
          <h2 className="panel-title">Mis pedidos</h2>
          <OrderList />
        </section>
        <aside className="panel">
          <h2 className="panel-title">Mis datos</h2>
          <Form form={form} {...blurValidation(form)} layout="vertical" requiredMark={false} initialValues={user} onFinish={save}>
            <Form.Item name="nombre" label="Nombre" rules={[{ required: true, min: 2 }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Email">
              <Input value={user.email} disabled />
            </Form.Item>
            <Form.Item name="telefono" label="Teléfono / WhatsApp">
              <Input />
            </Form.Item>
            <Form.Item name="direccion" label="Dirección">
              <Input />
            </Form.Item>
            <Collapse
              ghost
              size="small"
              items={[
                {
                  key: 'pw',
                  label: 'Cambiar contraseña',
                  children: (
                    <>
                      <Form.Item name="passwordActual" label="Contraseña actual">
                        <Input.Password autoComplete="current-password" />
                      </Form.Item>
                      <Form.Item name="passwordNueva" label="Nueva contraseña" rules={[{ min: 6, message: 'Mínimo 6 caracteres' }]}>
                        <Input.Password autoComplete="new-password" />
                      </Form.Item>
                    </>
                  ),
                },
              ]}
            />
            <Button type="primary" htmlType="submit" loading={saving} block className="mt">
              Guardar cambios
            </Button>
          </Form>
        </aside>
      </div>
    </div>
  )
}
