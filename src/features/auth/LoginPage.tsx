import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { AppLogo } from '@/components/AppLogo'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('returnUrl') || '/'
  const { login, isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (isAuthenticated) navigate(returnUrl, { replace: true })
  }, [isAuthenticated, navigate, returnUrl])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isLoading || isAuthenticated) {
    return (
      <div className="lg-login-page">
        <div className="lg-login-card lg-login-card--loading">
          <p className="lg-login-loading-text">확인 중…</p>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { error: loginError } = await login({ username, password })
      if (loginError) {
        setError(loginError)
        return
      }
      navigate(returnUrl, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="lg-login-page">
      <div className="lg-login-card">
        <div className="lg-login-logo" aria-hidden>
          <AppLogo size={40} />
        </div>
        <h1 className="lg-login-title">관리자 로그인</h1>
        <p className="lg-login-desc">관리자 계정으로 로그인하세요</p>

        <form onSubmit={handleSubmit} className="lg-login-form" noValidate>
          <div className="lg-login-field">
            <label htmlFor="lg-login-username" className="lg-login-label">
              아이디
            </label>
            <input
              id="lg-login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="lg-login-input"
              placeholder="아이디를 입력하세요"
              disabled={submitting}
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? 'lg-login-error' : undefined}
            />
          </div>
          <div className="lg-login-field">
            <label htmlFor="lg-login-password" className="lg-login-label">
              비밀번호
            </label>
            <input
              id="lg-login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="lg-login-input"
              placeholder="비밀번호를 입력하세요"
              disabled={submitting}
              aria-invalid={!!error}
              aria-describedby={error ? 'lg-login-error' : undefined}
            />
          </div>
          {error && (
            <p id="lg-login-error" className="lg-login-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="lg-login-submit"
          >
            {submitting ? '로그인 중…' : '로그인'}
          </Button>
        </form>
      </div>
    </div>
  )
}
