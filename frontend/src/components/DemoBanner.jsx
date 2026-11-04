import { useState } from 'react'
import { CloseOutlined } from '@ant-design/icons'

export default function DemoBanner() {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div className="demo-banner" role="status">
      <span>
        Demo con pagos simulados. Admin: <code>demo@rascateart.com</code> / <code>demo1234</code>
      </span>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar aviso" title="Cerrar aviso">
        <CloseOutlined />
      </button>
    </div>
  )
}
