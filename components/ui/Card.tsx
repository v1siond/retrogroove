import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Card({ children, style, ...props }: CardProps) {
  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-card)',
    padding: '20px',
    boxShadow: 'var(--shadow-frame)',
    ...style,
  }

  return <div style={cardStyle} {...props}>{children}</div>
}
