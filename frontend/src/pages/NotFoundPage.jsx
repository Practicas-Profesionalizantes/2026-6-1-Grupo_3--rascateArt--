import { Button } from 'antd'
import { navigate } from '../lib/router'
import EmptyState from '../components/EmptyState'

export default function NotFoundPage() {
  return (
    <div className="container narrow">
      <EmptyState
        title="No encontramos esta página"
        text="Puede que el link esté mal escrito o que la página ya no exista."
        action={<Button type="primary" onClick={() => navigate('/')}>Volver a la tienda</Button>}
      />
    </div>
  )
}
