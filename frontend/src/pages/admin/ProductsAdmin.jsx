import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, AutoComplete, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Upload } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'
import ProductImage from '../../components/ProductImage'

const money = {
  formatter: (v) => (v === undefined || v === null || v === '' ? '' : `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')),
  parser: (v) => (v ? v.replace(/[^\d]/g, '') : ''),
}

function ProductForm({ open, product, colecciones, onClose, onSaved }) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const imagen = Form.useWatch('imagen', form)
  const precio = Form.useWatch('precio', form)
  const descuento = Form.useWatch('descuento', form)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue(
      product
        ? { ...product, stock: product.stock ?? null }
        : { activo: true, destacado: false, descuento: 0, stock: null, coleccion: colecciones[0] }
    )
  }, [open, product, form, colecciones])

  const upload = async ({ file, onSuccess, onError }) => {
    setUploading(true)
    try {
      const r = await api('/api/admin/uploads', { method: 'POST', raw: file, headers: { 'Content-Type': file.type } })
      form.setFieldValue('imagen', r.url)
      onSuccess(r)
    } catch (e) {
      message.error(e.message)
      onError(e)
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const body = { ...values, stock: values.stock ?? null }
      const saved = product
        ? await api(`/api/admin/products/${product.id}`, { method: 'PUT', body })
        : await api('/api/admin/products', { method: 'POST', body })
      message.success(product ? 'Producto actualizado' : 'Producto creado')
      onSaved(saved)
    } catch (e) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const final = precio ? Math.round(precio * (1 - (descuento || 0) / 100)) : 0

  return (
    <Modal
      open={open}
      title={product ? `Editar: ${product.nombre}` : 'Nuevo producto'}
      onCancel={onClose}
      onOk={submit}
      okText={product ? 'Guardar cambios' : 'Crear producto'}
      cancelText="Cancelar"
      confirmLoading={saving}
      width={720}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} className="product-form">
        <div className="product-form-grid">
          <div>
            <div className="product-form-image">
              <ProductImage src={imagen} alt="Vista previa" />
            </div>
            <Upload accept="image/jpeg,image/png,image/webp,image/gif" showUploadList={false} customRequest={upload}>
              <Button icon={<UploadOutlined />} loading={uploading} block className="mt">
                Subir imagen
              </Button>
            </Upload>
            <Form.Item name="imagen" className="mt" extra="Máx. 5 MB. También podés pegar una URL.">
              <Input placeholder="/img/producto.webp" allowClear />
            </Form.Item>
          </div>
          <div>
            <Form.Item name="nombre" label="Nombre" rules={[{ required: true, min: 2, message: 'Ingresá el nombre' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="coleccion" label="Colección" rules={[{ required: true, message: 'Elegí o escribí una colección' }]}>
              <AutoComplete options={colecciones.map((c) => ({ value: c }))} filterOption={false} />
            </Form.Item>
            <div className="form-row">
              <Form.Item name="precio" label="Precio" rules={[{ required: true, message: 'Ingresá el precio' }]}>
                <InputNumber min={0} step={1000} style={{ width: '100%' }} {...money} />
              </Form.Item>
              <Form.Item name="descuento" label="Descuento %">
                <InputNumber min={0} max={90} style={{ width: '100%' }} />
              </Form.Item>
            </div>
            {descuento > 0 && <p className="muted small">Precio final: {formatMoney(final)}</p>}
            <Form.Item name="stock" label="Stock" extra="Dejalo vacío para no controlar stock (productos a pedido).">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="Sin control" />
            </Form.Item>
          </div>
        </div>
        <Form.Item name="descripcion" label="Descripción">
          <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Medidas, materiales, colores disponibles..." />
        </Form.Item>
        <Space size="large">
          <Form.Item name="activo" label="Visible en la tienda" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="destacado" label="Destacado" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  )
}

export default function ProductsAdmin() {
  const { message } = App.useApp()
  const [products, setProducts] = useState(null)
  const [editing, setEditing] = useState(undefined)
  const [q, setQ] = useState('')
  const [col, setCol] = useState('')

  const load = useCallback(() => {
    api('/api/admin/products').then(setProducts).catch((e) => message.error(e.message))
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const colecciones = useMemo(() => [...new Set((products || []).map((p) => p.coleccion))].sort(), [products])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (products || []).filter((p) => (!col || p.coleccion === col) && (!t || p.nombre.toLowerCase().includes(t)))
  }, [products, q, col])

  const toggle = async (p, activo) => {
    try {
      const saved = await api(`/api/admin/products/${p.id}`, { method: 'PUT', body: { activo } })
      setProducts((prev) => prev.map((x) => (x.id === p.id ? saved : x)))
    } catch (e) {
      message.error(e.message)
    }
  }

  const remove = async (p) => {
    try {
      await api(`/api/admin/products/${p.id}`, { method: 'DELETE' })
      setProducts((prev) => prev.filter((x) => x.id !== p.id))
      message.success('Producto eliminado')
    } catch (e) {
      message.error(e.message)
    }
  }

  const columns = [
    {
      title: '',
      dataIndex: 'imagen',
      width: 64,
      render: (src) => <ProductImage src={src} alt="" className="thumb admin-thumb" />,
    },
    {
      title: 'Producto',
      dataIndex: 'nombre',
      sorter: (a, b) => a.nombre.localeCompare(b.nombre),
      render: (n, p) => (
        <div>
          <strong>{n}</strong>
          <div className="muted small">
            {p.coleccion}
            {p.destacado && ' · Destacado'}
          </div>
        </div>
      ),
    },
    {
      title: 'Precio',
      dataIndex: 'precioFinal',
      sorter: (a, b) => a.precioFinal - b.precioFinal,
      render: (v, p) => (
        <div>
          {formatMoney(v)}
          {p.descuento > 0 && <div className="muted small">-{p.descuento}% de {formatMoney(p.precio)}</div>}
        </div>
      ),
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      sorter: (a, b) => (a.stock ?? 1e9) - (b.stock ?? 1e9),
      render: (s) => (s === null ? <span className="muted">A pedido</span> : s === 0 ? <Tag color="red">Sin stock</Tag> : s),
    },
    {
      title: 'Visible',
      dataIndex: 'activo',
      render: (a, p) => <Switch size="small" checked={a} onChange={(v) => toggle(p, v)} />,
    },
    {
      title: '',
      key: 'acciones',
      align: 'right',
      render: (_, p) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => setEditing(p)} aria-label="Editar" />
          <Popconfirm
            title="¿Eliminar producto?"
            description="Los pedidos existentes conservan el detalle."
            okText="Eliminar producto"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
            onConfirm={() => remove(p)}
          >
            <Button danger icon={<DeleteOutlined />} aria-label="Eliminar" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="admin-stack">
      <div className="admin-toolbar">
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar producto"
          allowClear
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <Select
          value={col}
          onChange={setCol}
          style={{ minWidth: 170 }}
          options={[{ value: '', label: 'Todas las colecciones' }, ...colecciones.map((c) => ({ value: c, label: c }))]}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)} className="ml-auto">
          Nuevo producto
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={!products}
        dataSource={filtered}
        columns={columns}
        scroll={{ x: 760 }}
        pagination={{ pageSize: 15, hideOnSinglePage: true }}
      />
      <ProductForm
        open={editing !== undefined}
        product={editing}
        colecciones={colecciones.length ? colecciones : ['Rascadores', 'Premium', 'Juguetes']}
        onClose={() => setEditing(undefined)}
        onSaved={(saved) => {
          setEditing(undefined)
          setProducts((prev) => (prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]))
        }}
      />
    </div>
  )
}
