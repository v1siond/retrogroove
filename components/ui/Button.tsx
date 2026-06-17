import React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: React.ReactNode
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '8px 18px', fontSize: '0.9rem' },
  md: { padding: '12px 28px', fontSize: '1rem' },
  lg: { padding: '15px 36px', fontSize: '1.15rem' },
}

export function Button({ variant = 'primary', size = 'md', children, style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-block',
    borderRadius: 'var(--radius-pill)',
    fontFamily: 'var(--font-display)',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
    textDecoration: 'none',
    textAlign: 'center',
    ...sizeStyles[size],
  }

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: 'var(--color-pink)',
      color: '#fff',
      boxShadow: 'var(--shadow-cta)',
    },
    secondary: {
      background: 'var(--color-surface-card)',
      color: 'var(--color-text)',
      border: '1px solid var(--color-border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-text)',
      border: '1px solid rgba(255,255,255,0.2)',
    },
  }

  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...props}>
      {children}
    </button>
  )
}
