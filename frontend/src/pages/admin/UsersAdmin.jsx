import { useEffect, useMemo, useState } from 'react'
import { App, Input, Select, Table } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { api } from '../../lib/api'
import { formatDate, formatMoney } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'

export default function UsersAdmin() {
  const { message, modal } = App.useApp()
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    api('/api/admin/users').then(setUsers).catch((e) => message.error(e.message))
  }, [message])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (users || []).filter((u) => !t || u.nombre.toLowerCase().includes(t) || u.email.includes(t))
  }, [users, q])

  const setRol = (u, rol) => {
    modal.confirm({
      title: rol === 'admin' ? `¿Dar acceso de administrador a ${u.nombre}?` : `¿Quitar acceso de administrador a ${u.nombre}?`,
      okText: 'Cambiar rol',
      cancelText: 'Volver',
      onOk: async () => {
        try {
          const saved = await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { rol } })
          setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...saved } : x)))
          message.success('Rol actualizado')
        } catch (e) {
          message.error(e.message)
        }
      },
    })
  }

  const columns = [
    {
      title: 'Cliente',
      dataIndex: 'nombre',
      sorter: (a, b) => a.nombre.localeCompare(b.nombre),
      render: (n, u) => (
        <div>
          <strong>{n}</strong>
          <div className="muted small">{u.email}</div>
        </div>
      ),
    },
    { title: 'Teléfono', dataIndex: 'telefono', responsive: ['md'], render: (t) => t || <span className="muted">—</span> },
    { title: 'Alta', dataIndex: 'createdAt', render: formatDate, responsive: ['lg'] },
    { title: 'Pedidos', dataIndex: 'pedidos', sorter: (a, b) => a.pedidos - b.pedidos },
    { title: 'Compras', dataIndex: 'gastado', render: formatMoney, sorter: (a, b) => a.gastado - b.gastado },
    {
      title: 'Rol',
      dataIndex: 'rol',
      render: (rol, u) => (
        <Select
          size="small"
          value={rol}
          disabled={u.id === me.id}
          onChange={(v) => setRol(u, v)}
          style={{ width: 130 }}
          options={[
            { value: 'cliente', label: 'Cliente' },
            { value: 'admin', label: 'Administrador' },
          ]}
        />
      ),
    },
  ]

  return (
    <div className="admin-stack">
      <div className="admin-toolbar">
        <Input prefix={<SearchOutlined />} placeholder="Buscar por nombre o email" allowClear value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 300 }} />
      </div>
      <Table rowKey="id" loading={!users} dataSource={filtered} columns={columns} scroll={{ x: 640 }} pagination={{ pageSize: 20, hideOnSinglePage: true }} />
    </div>
  )
}
