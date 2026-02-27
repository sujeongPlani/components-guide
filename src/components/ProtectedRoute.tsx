import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * 인증된 사용자만 자식 라우트를 렌더링.
 * 비인증 시 /login으로 리다이렉트 (returnUrl 쿼리로 현재 경로 전달)
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg)' }}>
        <LoadingSpinner size={32} />
      </div>
    )
  }

  if (!isAuthenticated) {
    const returnUrl = location.pathname + location.search
    const to = returnUrl && returnUrl !== '/' ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'
    return <Navigate to={to} replace state={{ from: location }} />
  }

  return <>{children}</>
}
