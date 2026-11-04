import { useState } from 'react'
import { App, Button, Form, Input, Radio } from 'antd'
import { api, PENDING_ORDER_KEY, redirectTo } from '../lib/api'
import { Link, navigate } from '../lib/router'
import { formatMoney } from '../lib/format'
import { shippingFor, useShop } from '../context/ShopContext'
import { useAuth } from '../context/AuthContext'
import ProductImage from '../components/ProductImage'
import EmptyState from '../components/EmptyState'
import { blurValidation } from '../lib/forms'

export default function CheckoutPage() {
  const { message } = App.useApp()
  const { cart, subtotal, config, reload } = useShop()
  const { user } = useAuth()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const entrega = Form.useWatch('entrega', form) || 'envio'

  const envio = shippingFor(config, subtotal, entrega)
  const total = subtotal + envio

  const onFinish = async (values) => {
    if (!config.mpEnabled) {
      message.error('Los pagos están pausados en este momento. Probá de nuevo en un rato.')
      return
    }
    setSubmitting(true)
    try {
      const res = await api('/api/orders', {
        method: 'POST',
        body: {
          items: cart.map((i) => ({ id: i.id, cantidad: i.cantidad })),
          cliente: { nombre: values.nombre, email: values.email, telefono: values.telefono, direccion: values.direccion },
          entrega: values.entrega,
          notas: values.notas,
        },
      })
      try {
        localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ orderId: res.orderId, accessKey: res.accessKey }))
      } catch {
        /* almacenamiento no disponible */
      }
      redirectTo(res.initPoint)
    } catch (e) {
      message.error(e.message)
      if (e.status === 409) reload()
      setSubmitting(false)
    }
  }

  if (cart.length === 0) {
    return (
      <div className="container narrow">
        <EmptyState
          title="Tu carrito está vacío"
          text="Agregá productos para finalizar la compra."
          action={<Button type="primary" onClick={() => navigate('/')}>Ver el catálogo</Button>}
        />
      </div>
    )
  }

  const envioLabel =
    entrega === 'retiro' ? 'Sin cargo' : config.shippingCost ? (envio ? formatMoney(envio) : 'Gratis') : 'A coordinar'

  return (
    <div className="container">
      <h1 className="page-title">Finalizar compra</h1>
      <div className="checkout">
        <section className="panel">
          {!user && (
            <p className="muted small mb">
              Comprás como invitado. <Link to="/ingresar?next=/checkout" className="link">Ingresá a tu cuenta</Link> para guardar tus pedidos.
            </p>
          )}
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            onFinishFailed={({ errorFields }) => errorFields[0] && form.scrollToField(errorFields[0].name, { block: 'center' })}
            {...blurValidation(form)}
            initialValues={{
              entrega: 'envio',
              nombre: user?.nombre,
              email: user?.email,
              telefono: user?.telefono,
              direccion: user?.direccion,
            }}
          >
            <h2 className="panel-title">Tus datos</h2>
            <Form.Item name="nombre" label="Nombre y apellido" rules={[{ required: true, min: 2, message: 'Ingresá tu nombre' }]}>
              <Input autoComplete="name" />
            </Form.Item>
            <div className="form-row">
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Ingresá un email válido' }]}>
                <Input autoComplete="email" inputMode="email" />
              </Form.Item>
              <Form.Item
                name="telefono"
                label="Teléfono / WhatsApp"
                rules={[{ required: true, pattern: /\d{6,}/, transform: (v) => v?.replace(/\D/g, ''), message: 'Ingresá un teléfono válido' }]}
              >
                <Input autoComplete="tel" inputMode="tel" placeholder="11 2345 6789" />
              </Form.Item>
            </div>

            <h2 className="panel-title">Entrega</h2>
            <Form.Item name="entrega">
              <Radio.Group className="delivery-options">
                <Radio value="envio">
                  <strong>Envío a domicilio</strong>
                  <span className="muted small">
                    {config.shippingCost
                      ? `${formatMoney(config.shippingCost)}${config.freeShippingFrom ? ` · gratis desde ${formatMoney(config.freeShippingFrom)}` : ''}`
                      : 'Costo a coordinar según zona'}
                  </span>
                </Radio>
                <Radio value="retiro">
                  <strong>Retiro</strong>
                  <span className="muted small">Coordinamos el punto de retiro por WhatsApp</span>
                </Radio>
              </Radio.Group>
            </Form.Item>
            {entrega === 'envio' && (
              <Form.Item name="direccion" label="Dirección de envío" rules={[{ required: true, min: 5, message: 'Ingresá la dirección' }]}>
                <Input autoComplete="street-address" placeholder="Calle, número, piso, localidad" />
              </Form.Item>
            )}
            <Form.Item name="notas" label="Notas (opcional)">
              <Input.TextArea rows={2} maxLength={500} placeholder="Horarios, referencias, color preferido..." />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={submitting}
            >
              Pagar {formatMoney(total)} con Mercado Pago
            </Button>
            <p className="muted small center mt">
              Vas a pagar en Mercado Pago con tarjeta, dinero en cuenta o efectivo.
            </p>
          </Form>
        </section>

        <aside className="panel summary">
          <h2 className="panel-title">Resumen</h2>
          <ul className="summary-list">
            {cart.map((i) => (
              <li key={i.id}>
                <ProductImage src={i.imagen} alt="" className="thumb summary-thumb" />
                <span className="summary-name">
                  {i.nombre}
                  <small className="muted"> × {i.cantidad}</small>
                </span>
                <span>{formatMoney(i.precioFinal * i.cantidad)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Envío</span>
            <span>{envioLabel}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </aside>
      </div>
    </div>
  )
}
