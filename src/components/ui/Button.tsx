import React, { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 's' | 'm'
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { background: 'var(--color-primary)', color: '#fff' },
  secondary: { background: 'var(--color-border)', color: 'var(--color-text)' },
  ghost: { color: 'var(--color-text)' },
  danger: { background: 'var(--color-danger)', color: '#fff' },
}

const sizeStyles: Record<string, React.CSSProperties> = {
  s: { padding: '4px 8px', fontSize: 14 },
  m: { padding: '8px 12px', fontSize: 14 },
}

export function Button({
  variant = 'primary',
  size = 'm',
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontWeight: 500,
        borderRadius: 'var(--radius)',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}
