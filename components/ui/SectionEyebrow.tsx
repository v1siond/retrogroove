import React from 'react'

interface SectionEyebrowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SectionEyebrow({ children, style, ...props }: SectionEyebrowProps) {
  return (
    <div
      style={{
        fontSize: '0.6rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--color-cyan)',
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        marginBottom: '10px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
