import { useEffect, useState } from 'react'
import { App, Button, Card, Col, Row, Skeleton, Statistic, Table } from 'antd'
import { api } from '../../lib/api'
import { navigate } from '../../lib/router'
import { ESTADOS, formatDate, formatMoney } from '../../lib/format'
import OrderStatusTag from '../../components/OrderStatusTag'

export default function Dashboard() {
  const { message } = App.useApp()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api('/api/admin/stats').then(setStats).catch((e) => message.error(e.message))
  }, [message])

  if (!stats) return <Skeleton active paragraph={{ rows: 8 }} />

  const cards = [
    { title: 'Ventas del mes', value: formatMoney(stats.ventasMes), extra: `Total histórico ${formatMoney(stats.ventasTotal)}` },
    { title: 'Pedidos pagados', value: stats.pedidosPagados, extra: `${stats.pedidos} pedidos en total` },
    { title: 'Clientes', value: stats.usuarios, extra: 'Cuentas registradas' },
    { title: 'Productos activos', value: stats.productosActivos, extra: stats.sinStock ? `${stats.sinStock} sin stock` : `${stats.productos} en total` },
  ]

  return (
    <div className="admin-stack">
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} xl={6} key={c.title}>
            <Card className="stat-card">
              <Statistic title={c.title} value={c.value} />
              <span className="muted small">{c.extra}</span>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="Últimos pedidos" extra={<Button type="link" onClick={() => navigate('/admin/pedidos')}>Ver todos los pedidos</Button>}>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={stats.ultimos}
              scroll={{ x: 520 }}
              locale={{ emptyText: <p className="muted small">Todavía no hay pedidos.</p> }}
              columns={[
                { title: '#', dataIndex: 'id', width: 60 },
                { title: 'Cliente', dataIndex: 'nombre' },
                { title: 'Fecha', dataIndex: 'createdAt', render: (d) => <span className="nowrap">{formatDate(d)}</span> },
                { title: 'Estado', dataIndex: 'estado', render: (e) => <OrderStatusTag estado={e} /> },
                { title: 'Total', dataIndex: 'total', align: 'right', render: formatMoney },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="Pedidos por estado" className="mb">
            {Object.keys(stats.porEstado).length === 0 ? (
              <p className="muted small">Sin datos</p>
            ) : (
              <ul className="status-list">
                {Object.entries(ESTADOS).map(([k, v]) =>
                  stats.porEstado[k] ? (
                    <li key={k}>
                      <OrderStatusTag estado={k} />
                      <strong>{stats.porEstado[k]}</strong>
                      <span className="sr-only">{v.label}</span>
                    </li>
                  ) : null
                )}
              </ul>
            )}
          </Card>
          <Card title="Más vendidos">
            {stats.topProductos.length === 0 ? (
              <p className="muted small">Sin ventas todavía</p>
            ) : (
              <ol className="top-list">
                {stats.topProductos.map((p) => (
                  <li key={p.nombre}>
                    <span>{p.nombre}</span>
                    <span className="muted">{p.unidades} u.</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
