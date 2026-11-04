import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Descriptions, Drawer, Input, Select, Table } from 'antd'
import { EyeOutlined, ReloadOutlined, SearchOutlined, WhatsAppOutlined, MailOutlined } from '@ant-design/icons'
import { api } from '../../lib/api'
import { ESTADOS, PAYMENT_TYPES, formatDate, formatMoney, whatsappLink } from '../../lib/format'
import OrderStatusTag from '../../components/OrderStatusTag'
import { useShop } from '../../context/ShopContext'

const estadoOptions = Object.entries(ESTADOS).map(([value, e]) => ({ value, label: e.label }))

function OrderDetail({ order, onClose, onChangeEstado }) {
  if (!order) return null
  const wa = whatsappLink(order.telefono, `Hola ${order.nombre.split(' ')[0]}! Te escribimos de Rascate Art por tu pedido #${order.id}.`)
  return (
    <Drawer open title={`Pedido #${order.id}`} onClose={onClose} size={520}>
      <div className="admin-stack">
        <div className="admin-toolbar">
          <Select value={order.estado} options={estadoOptions} onChange={(v) => onChangeEstado(order, v)} style={{ minWidth: 200 }} />
          {wa && (
            <Button icon={<WhatsAppOutlined />} href={wa} target="_blank" rel="noreferrer">
              WhatsApp
            </Button>
          )}
          <Button icon={<MailOutlined />} href={`mailto:${order.email}?subject=Tu pedido %23${order.id} en Rascate Art`}>
            Email
          </Button>
        </div>

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Fecha">{formatDate(order.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Cliente">{order.nombre}</Descriptions.Item>
          <Descriptions.Item label="Email">{order.email}</Descriptions.Item>
          <Descriptions.Item label="Teléfono">{order.telefono}</Descriptions.Item>
          <Descriptions.Item label="Entrega">{order.entrega === 'retiro' ? 'Retiro' : `Envío a ${order.direccion}`}</Descriptions.Item>
          {order.notas && <Descriptions.Item label="Notas">{order.notas}</Descriptions.Item>}
        </Descriptions>

        <Descriptions column={1} size="small" bordered title="Mercado Pago">
          <Descriptions.Item label="Estado MP">{order.mpStatus || 'Sin pago registrado'}</Descriptions.Item>
          {order.mpStatusDetail && <Descriptions.Item label="Detalle">{order.mpStatusDetail}</Descriptions.Item>}
          {order.mpPaymentId && <Descriptions.Item label="ID de pago">{order.mpPaymentId}</Descriptions.Item>}
          {order.mpPaymentType && <Descriptions.Item label="Medio">{PAYMENT_TYPES[order.mpPaymentType] || order.mpPaymentType}</Descriptions.Item>}
        </Descriptions>

        <div>
          <ul className="summary-list compact">
            {order.items.map((i, idx) => (
              <li key={idx}>
                <span className="summary-name">
                  {i.nombre} <small className="muted">× {i.cantidad}</small>
                </span>
                <span>{formatMoney(i.precio * i.cantidad)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Envío</span>
            <span>{order.entrega === 'retiro' ? 'Retiro' : order.envio ? formatMoney(order.envio) : 'A coordinar'}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <strong>{formatMoney(order.total)}</strong>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

export default function OrdersAdmin() {
  const { message, modal } = App.useApp()
  const [orders, setOrders] = useState(null)
  const [estado, setEstado] = useState('')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const { config } = useShop()

  const fetchOrders = useCallback(() => {
    return api('/api/admin/orders').then(setOrders).catch((e) => message.error(e.message))
  }, [message])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const load = () => {
    setOrders(null)
    fetchOrders()
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (orders || []).filter(
      (o) =>
        (!estado || o.estado === estado) &&
        (!t || String(o.id) === t.replace('#', '') || o.nombre.toLowerCase().includes(t) || o.email.includes(t))
    )
  }, [orders, estado, q])

  const applyEstado = async (order, nuevo) => {
    try {
      const saved = await api(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: { estado: nuevo } })
      setOrders((prev) => prev.map((o) => (o.id === saved.id ? saved : o)))
      message.success(`Pedido #${order.id}: ${ESTADOS[nuevo].label}${config.mailEnabled && nuevo !== 'pendiente' && nuevo !== 'rechazado' ? '. Le avisamos al cliente por email.' : ''}`)
    } catch (e) {
      message.error(e.message)
    }
  }

  const changeEstado = (order, nuevo) => {
    if (nuevo === 'cancelado' || (order.estado === 'pendiente' && nuevo !== 'rechazado')) {
      modal.confirm({
        title: `¿Marcar el pedido #${order.id} como "${ESTADOS[nuevo].label}"?`,
        content:
          nuevo === 'cancelado'
            ? 'Si ya estaba pagado, el stock vuelve a sumarse. El reembolso se hace desde Mercado Pago.'
            : 'El pedido todavía no tiene un pago aprobado en Mercado Pago.',
        okText: 'Cambiar estado',
        cancelText: 'Volver',
        onOk: () => applyEstado(order, nuevo),
      })
    } else {
      applyEstado(order, nuevo)
    }
  }

  const columns = [
    { title: '#', dataIndex: 'id', width: 70, sorter: (a, b) => a.id - b.id, defaultSortOrder: 'descend' },
    { title: 'Fecha', dataIndex: 'createdAt', render: (d) => <span className="nowrap">{formatDate(d)}</span>, responsive: ['md'] },
    {
      title: 'Cliente',
      dataIndex: 'nombre',
      render: (n, o) => (
        <div>
          <strong>{n}</strong>
          <div className="muted small">{o.email}</div>
        </div>
      ),
    },
    {
      title: 'Productos',
      key: 'items',
      responsive: ['lg'],
      render: (_, o) => <span className="small">{o.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}</span>,
    },
    { title: 'Total', dataIndex: 'total', align: 'right', render: formatMoney, sorter: (a, b) => a.total - b.total },
    {
      title: 'Estado',
      dataIndex: 'estado',
      render: (e, o) => (
        <Select size="small" value={e} options={estadoOptions} onChange={(v) => changeEstado(o, v)} style={{ width: 170 }} labelRender={() => <OrderStatusTag estado={e} />} />
      ),
    },
    {
      title: '',
      key: 'ver',
      align: 'right',
      render: (_, o) => <Button icon={<EyeOutlined />} onClick={() => setSelectedId(o.id)} aria-label="Ver detalle" />,
    },
  ]

  return (
    <div className="admin-stack">
      <div className="admin-toolbar">
        <Input prefix={<SearchOutlined />} placeholder="Buscar por #, nombre o email" allowClear value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 300 }} />
        <Select value={estado} onChange={setEstado} style={{ minWidth: 190 }} options={[{ value: '', label: 'Todos los estados' }, ...estadoOptions]} />
        <Button icon={<ReloadOutlined />} onClick={load} className="ml-auto">
          Actualizar
        </Button>
      </div>
      <Table rowKey="id" loading={!orders} dataSource={filtered} columns={columns} scroll={{ x: 720 }} pagination={{ pageSize: 20, hideOnSinglePage: true }} />
      <OrderDetail order={orders?.find((o) => o.id === selectedId)} onClose={() => setSelectedId(null)} onChangeEstado={changeEstado} />
    </div>
  )
}
