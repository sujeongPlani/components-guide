/**
 * 앱 로고 (DX)
 * 사용처: 사이드바, 로그인 화면
 */
export function AppLogo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', objectFit: 'contain' }}
      aria-hidden
    />
  )
}
