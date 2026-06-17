import React from 'react'

type ChipVariant = 'gold' | 'plain' | 'cyan'

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant
  children: React.ReactNode
}

export function Chip({ variant = 'plain', children, style, ...props }: ChipProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    borderRadius: 'var(--radius-pill)',
    fontSize: '0.74rem',
    lineHeight: 1,
  }

  const variants: Record<ChipVariant, React.CSSProperties> = {
    gold: {
      background: 'rgba(255,215,0,0.1)',
      border: '1px solid rgba(255,215,0,0.55)',
      color: 'var(--color-gold)',
    },
    plain: {
      background: 'var(--color-surface-card)',
      border: '1px solid rgba(255,255,255,0.15)',
      color: 'rgba(236,230,240,0.75)',
    },
    cyan: {
      background: 'rgba(0,229,255,0.1)',
      border: '1px solid rgba(0,229,255,0.4)',
      color: 'var(--color-cyan)',
    },
  }

  return <span style={{ ...base, ...variants[variant], ...style }} {...props}>{children}</span>
}
