import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, tokenStore } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!tokenStore.get())

  useEffect(() => {
    if (!tokenStore.get()) return
    api('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (email, password) => {
    const d = await api('/api/auth/login', { method: 'POST', body: { email, password } })
    tokenStore.set(d.token)
    setUser(d.user)
    return d.user
  }, [])

  const register = useCallback(async (values) => {
    const d = await api('/api/auth/register', { method: 'POST', body: values })
    tokenStore.set(d.token)
    setUser(d.user)
    return d.user
  }, [])

  const updateProfile = useCallback(async (values) => {
    const d = await api('/api/auth/me', { method: 'PUT', body: values })
    setUser(d.user)
    return d.user
  }, [])

  const logout = useCallback(() => {
    tokenStore.set(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, isAdmin: user?.rol === 'admin', login, register, updateProfile, logout }),
    [user, ready, login, register, updateProfile, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
