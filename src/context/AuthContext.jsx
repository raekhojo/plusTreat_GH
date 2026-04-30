import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getMe, loginUser, logoutUser, setStoredToken } from '../lib/api'

const AuthContext = createContext(null)

function buildSessionUser(data) {
  const profile = data?.profile || {}
  const user = data?.user || profile?.user || {}
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return {
    id: profile?.id ?? user.id ?? null,
    name: fullName || user.username || 'Staff',
    email: user.email || '',
    username: user.username || '',
    role: profile?.role || 'Staff',
    phone: profile?.phone || '',
    isSalesStaff: Boolean(profile?.is_sales_staff),
    isActive: user.is_active !== false,
    staffProfileId: profile?.id ?? null,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isReady, setIsReady] = useState(false)

  // On mount, attempt to rehydrate session from stored token via /api/auth/me/
  useEffect(() => {
    getMe()
      .then((data) => setUser(buildSessionUser(data)))
      .catch(() => {
        setStoredToken(null)
        setUser(null)
      })
      .finally(() => setIsReady(true))
  }, [])

  const value = useMemo(() => ({
    user,
    isReady,
    isAuthenticated: Boolean(user),
    async login(identifier, password) {
      const data = await loginUser(identifier, password)
      setStoredToken(data.token)
      const nextUser = buildSessionUser(data)
      setUser(nextUser)
      return nextUser
    },
    async logout() {
      await logoutUser().catch(() => {})
      setStoredToken(null)
      setUser(null)
    },
  }), [user, isReady])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
