/* eslint-disable react-refresh/only-export-components -- context files intentionally export provider + hook together (Phase 1 S-04) */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import axiosInstance from '../../lib/api/client'
import { setAuthenticatedUser, setAuthLoading } from '../../lib/api/session'
import type { AuthUser, UserRole } from '../../lib/api/auth'

export type SessionUser = {
  id?: string
  firstName: string
  lastName: string
  role: UserRole
  email?: string
  profilePicture?: string | null
  [key: string]: unknown
}

type AuthContextValue = {
  user: SessionUser | null
  loading: boolean
  setUser: (user: AuthUser | null) => void
  refreshUser: () => Promise<SessionUser | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export default AuthContext

function normalizeUser(user: AuthUser | null): SessionUser | null {
  if (!user) return null

  const role: UserRole = user.role === 'user' ? 'patient' : (user.role ?? 'patient')
  return {
    ...user,
    id: user.id || user._id || user.userId,
    firstName: user.firstName || user.firstname || '',
    lastName: user.lastName || user.lastname || '',
    role,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const setAuthUser = useCallback((nextUser: AuthUser | null) => {
    const normalizedUser = normalizeUser(nextUser)
    setAuthenticatedUser(normalizedUser)
    setUser(normalizedUser)
  }, [])

  const refreshUser = useCallback(async () => {
    setLoading(true)
    setAuthLoading(true)
    try {
      const response = await axiosInstance.get('/auth/me')
      const currentUser = (response.data?.user || response.data) as AuthUser | null
      const nextUser = normalizeUser(currentUser)
      setAuthUser(nextUser)
      return nextUser
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)?.response?.status
      if (status !== 401) console.error(error)
      setAuthUser(null)
      return null
    } finally {
      setLoading(false)
      setAuthLoading(false)
    }
  }, [setAuthUser])

  async function logout() {
    try {
      await axiosInstance.post('/auth/logout')
    } catch (error) {
      const status = (error as { response?: { status?: number } } | null)?.response?.status
      if (status !== 401) console.error(error)
    } finally {
      setAuthUser(null)
    }
  }

  useEffect(() => {
    const request = window.setTimeout(() => refreshUser(), 0)
    return () => window.clearTimeout(request)
  }, [refreshUser])

  useEffect(() => {
    function handleUnauthorized() {
      setAuthUser(null)
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [setAuthUser])

  return (
    <AuthContext.Provider value={{ user, loading, setUser: setAuthUser, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
