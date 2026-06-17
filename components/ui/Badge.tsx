import React from 'react'

type BadgeVariant = 'green' | 'red' | 'cyan' | 'gold'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children: React.ReactNode
}

export function Badge({ variant = 'green', children, style, ...props }: BadgeProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 'var(--radius-pill)',
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-body)',
  }

  const variants: Record<BadgeVariant, React.CSSProperties> = {
    green: {
      background: 'rgba(34,197,94,0.12)',
      border: '1px solid rgba(34,197,94,0.4)',
      color: 'var(--color-green)',
    },
    red: {
      background: 'rgba(255,90,110,0.12)',
      border: '1px solid rgba(255,90,110,0.4)',
      color: 'var(--color-red)',
    },
    cyan: {
      background: 'rgba(0,229,255,0.12)',
      border: '1px solid rgba(0,229,255,0.5)',
      color: 'var(--color-cyan)',
    },
    gold: {
      background: 'rgba(255,215,0,0.1)',
      border: '1px solid rgba(255,215,0,0.5)',
      color: 'var(--color-gold)',
    },
  }

  return <span style={{ ...base, ...variants[variant], ...style }} {...props}>{children}</span>
}
