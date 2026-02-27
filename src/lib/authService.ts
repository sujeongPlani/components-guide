/**
 * 인증 서비스
 * - 현재: mock 로그인 (admin / 1234), localStorage 저장
 * - 추후 Supabase 등으로 교체 시 이 인터페이스만 구현하면 됨
 */

const AUTH_STORAGE_KEY = 'live-guide-auth'

export interface AuthUser {
  id: string
  username: string
  /** 추후 Supabase: email, avatar_url 등 확장 */
}

export interface AuthSession {
  user: AuthUser
  /** 만료 시각(ms). mock에서는 무제한 */
  expiresAt?: number
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResult {
  user?: AuthUser
  error?: string
}

/** 인증 서비스 인터페이스 (Supabase 교체 시 동일 시그니처로 구현) */
export interface IAuthService {
  login(credentials: LoginCredentials): Promise<LoginResult>
  logout(): Promise<void>
  getSession(): AuthSession | null
  isAuthenticated(): boolean
}

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as AuthSession
    if (!data?.user?.id) return null
    if (data.expiresAt != null && Date.now() > data.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function saveSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

function clearSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

/** Mock 인증 서비스 (admin / 1234) */
const mockAuthService: IAuthService = {
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const { username, password } = credentials
    const trimmedId = username.trim()
    const trimmedPw = password.trim()
    if (!trimmedId || !trimmedPw) {
      return { error: '아이디와 비밀번호를 입력해 주세요.' }
    }
    if (trimmedId === 'admin' && trimmedPw === '1234') {
      const session: AuthSession = {
        user: { id: 'mock-admin', username: trimmedId },
      }
      saveSession(session)
      return { user: session.user }
    }
    return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  },

  async logout(): Promise<void> {
    clearSession()
  },

  getSession(): AuthSession | null {
    return loadSession()
  },

  isAuthenticated(): boolean {
    return loadSession() != null
  },
}

/** 실제 사용할 인증 서비스 인스턴스 (추후 Supabase로 교체) */
export const authService: IAuthService = mockAuthService
