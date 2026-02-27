import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { AuthSession, AuthUser, LoginCredentials } from '@/lib/authService'
import { authService } from '@/lib/authService'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<{ error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => authService.getSession())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setSession(authService.getSession())
    setIsLoading(false)
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const result = await authService.login(credentials)
    if (result.user) {
      setSession({ user: result.user })
      return {}
    }
    return { error: result.error ?? '로그인에 실패했습니다.' }
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setSession(null)
  }, [])

  const value: AuthContextValue = {
    user: session?.user ?? null,
    isAuthenticated: session != null,
    isLoading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
