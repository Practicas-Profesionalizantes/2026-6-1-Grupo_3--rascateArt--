import { Tag } from 'antd'
import { ESTADOS } from '../lib/format'

export default function OrderStatusTag({ estado }) {
  const e = ESTADOS[estado] || { label: estado, color: 'default' }
  return <Tag color={e.color}>{e.label}</Tag>
}
