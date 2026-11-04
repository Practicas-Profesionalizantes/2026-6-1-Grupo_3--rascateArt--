import { navigate } from './router'

export const DEMO = import.meta.env.VITE_DEMO === 'true'
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'rascate:token'

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (t) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* almacenamiento no disponible */
    }
  },
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function api(path, { method = 'GET', body, raw, headers = {} } = {}) {
  const token = tokenStore.get()
  if (DEMO) {
    const { demoApi } = await import('./demoApi')
    try {
      return await demoApi(path, { method, body, raw, token })
    } catch (e) {
      throw new ApiError(e.status || 500, e.message)
    }
  }
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new ApiError(0, 'No pudimos conectarnos con el servidor. Revisá tu conexión.')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) tokenStore.set(null)
    throw new ApiError(res.status, data?.error || 'Ocurrió un error inesperado')
  }
  return data
}

export const assetUrl = (url) => {
  if (!url) return url
  if (DEMO && url.startsWith('/') && !url.startsWith('//')) return '.' + url
  return url.startsWith('/uploads/') ? BASE + url : url
}

export const LOGO = assetUrl('/logo.webp')

export const PENDING_ORDER_KEY = 'rascate:pendingOrder'

export const redirectTo = (url) => (DEMO ? navigate(url) : window.location.assign(url))
