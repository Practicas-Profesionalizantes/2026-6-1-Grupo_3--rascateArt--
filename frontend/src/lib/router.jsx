/* eslint-disable react-refresh/only-export-components */
import { useSyncExternalStore } from 'react'

const HASH_MODE = import.meta.env.VITE_DEMO === 'true'
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
let hashQuery = ''
let internalHashChange = false

const hashToPath = (hash) => {
  const h = hash.replace(/^#/, '')
  if (!h) return '/'
  if (h === 'mi-cuenta') return '/mi-cuenta'
  const i = h.indexOf('-')
  return i < 0 ? `/${h}` : `/${h.slice(0, i)}/${h.slice(i + 1)}`
}

const pathToHash = (path) => (path === '/' ? '' : path.slice(1).replace('/', '-'))

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', emit)
  if (HASH_MODE) {
    window.addEventListener('hashchange', () => {
      if (!internalHashChange) hashQuery = ''
      internalHashChange = false
      emit()
    })
  }
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const getSnapshot = HASH_MODE
  ? () => hashToPath(window.location.hash) + hashQuery
  : () => window.location.pathname + window.location.search

export function hrefFor(to) {
  return HASH_MODE ? `#${pathToHash(to.split('?')[0])}` : to
}

export function navigate(to, { replace = false } = {}) {
  if (to === getSnapshot()) return
  if (HASH_MODE) {
    const [path, query] = to.split('?')
    hashQuery = query ? `?${query}` : ''
    const hash = pathToHash(path)
    if (window.location.hash.replace(/^#/, '') === hash) {
      emit()
    } else {
      internalHashChange = true
      if (replace) window.location.replace(`#${hash}`)
      else window.location.hash = hash
    }
  } else {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', to)
    emit()
  }
  window.scrollTo({ top: 0, behavior: 'instant' })
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, getSnapshot)
  const url = new URL(href, 'http://local')
  return { pathname: url.pathname, search: url.searchParams }
}

export function matchPath(pattern, pathname) {
  const keys = []
  const regex = new RegExp(
    '^' + pattern.replace(/\/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '/([^/]+)')) + '/?$'
  )
  const m = pathname.match(regex)
  if (!m) return null
  return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
}

export function Link({ to, children, onClick, ...rest }) {
  return (
    <a
      href={hrefFor(to)}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
