import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getMe, getStoredToken, loginUser, logoutUser, setStoredToken } from '../lib/api'

const AuthContext = createContext(null)

// The signed-in user is cached next to the token so a page refresh can render
// straight away instead of waiting (blank) for /auth/me to come back.
const SESSION_USER_KEY = 'plusTreatUser'

function readCachedUser() {
  if (!getStoredToken()) return null
  try {
    return JSON.parse(localStorage.getItem(SESSION_USER_KEY) || 'null')
  } catch {
    return null
  }
}

function cacheUser(user) {
  if (user) localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(SESSION_USER_KEY)
}

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
  const [user, setUser] = useState(readCachedUser)
  // A cached user means we can show the app immediately on refresh.
  const [isReady, setIsReady] = useState(() => Boolean(readCachedUser()))

  // On mount, attempt to rehydrate session from stored token via /api/auth/me/
  useEffect(() => {
    const hadCachedUser = Boolean(readCachedUser())
    getMe()
      .then((data) => {
        const nextUser = buildSessionUser(data)
        cacheUser(nextUser)
        setUser(nextUser)
      })
      .catch((error) => {
        // Keep a cached session through a slow or failed check; only log out
        // when the server actually rejects the token (or there is no session).
        if (hadCachedUser && error?.status !== 401 && error?.status !== 403) return
        setStoredToken(null)
        cacheUser(null)
        setUser(null)
      })
      .finally(() => setIsReady(true))
  }, [])

  const value = useMemo(() => ({
    user,
    isReady,
    isAuthenticated: Boolean(user),
    updateSession(data) {
      const nextUser = buildSessionUser(data)
      cacheUser(nextUser)
      setUser(nextUser)
      return nextUser
    },
    async login(identifier, password) {
      const data = await loginUser(identifier, password)
      setStoredToken(data.token)
      const nextUser = buildSessionUser(data)
      cacheUser(nextUser)
      setUser(nextUser)
      return nextUser
    },
    async logout() {
      await logoutUser().catch(() => {})
      setStoredToken(null)
      cacheUser(null)
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
