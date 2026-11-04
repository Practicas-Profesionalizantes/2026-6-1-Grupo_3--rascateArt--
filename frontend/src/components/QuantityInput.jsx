import { Button } from 'antd'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'

export default function QuantityInput({ value, onChange, max = 99, min = 1, size = 'middle' }) {
  return (
    <div className={`qty qty-${size}`} role="group" aria-label="Cantidad">
      <Button type="text" icon={<MinusOutlined />} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Restar uno" title="Restar uno" />
      <span aria-live="polite">{value}</span>
      <Button type="text" icon={<PlusOutlined />} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Sumar uno" title="Sumar uno" />
    </div>
  )
}
