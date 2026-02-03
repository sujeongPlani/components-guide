import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{ padding: 24, maxWidth: 600, margin: '40px auto', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
          <h2 style={{ color: '#dc2626', marginTop: 0 }}>오류가 발생했습니다</h2>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 14 }}>{this.state.error.message}</pre>
          <p style={{ color: '#666' }}>위 메시지를 확인한 뒤 코드를 수정하거나, 페이지를 새로고침해 보세요.</p>
        </div>
      )
    }
    return this.props.children
  }
}
