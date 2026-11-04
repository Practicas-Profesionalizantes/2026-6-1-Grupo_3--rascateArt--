import { useState } from 'react'
import { assetUrl } from '../lib/api'

export default function ProductImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`product-image ${className}`}>
      {src && !failed ? (
        <img src={assetUrl(src)} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="img-placeholder" role="img" aria-label={alt}>
          <span>Foto próximamente</span>
        </div>
      )}
    </div>
  )
}
