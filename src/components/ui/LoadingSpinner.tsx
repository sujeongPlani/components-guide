import type { HTMLAttributes } from 'react'

interface LoadingSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  /** 스피너 크기 (px). 기본 32 */
  size?: number
  /** 스피너 색. 기본 primary */
  color?: string
}

/**
 * 로딩 중 표시용 회전 스피너 아이콘
 */
export function LoadingSpinner({ size = 32, color = 'var(--color-primary)', className = '', ...rest }: LoadingSpinnerProps) {
  return (
    <div
      className={`lg-loading-spinner ${className}`.trim()}
      role="status"
      aria-label="로딩 중"
      style={
        {
          '--lg-spinner-size': `${size}px`,
          '--lg-spinner-color': color,
        } as React.CSSProperties
      }
      {...rest}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1.5 4"
        style={{ color }}
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
      </svg>
    </div>
  )
}
