import React from 'react'

interface SeatLegendProps extends React.HTMLAttributes<HTMLDivElement> {}

export function SeatLegend({ style, ...props }: SeatLegendProps) {
  const entries = [
    {
      label: 'disponible',
      id: 'disponible',
      swatchStyle: {
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'rgba(0,229,255,0.12)',
        border: '2px solid var(--color-cyan)',
      },
    },
    {
      label: 'seleccionado',
      id: 'seleccionado',
      swatchStyle: {
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'var(--color-pink)',
        boxShadow: 'var(--shadow-seat-selected)',
      },
    },
    {
      label: 'ocupado',
      id: 'ocupado',
      swatchStyle: {
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
      },
    },
  ]

  return (
    <div
      style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', ...style }}
      {...props}
    >
      {entries.map(({ label, id, swatchStyle }) => (
        <div
          key={id}
          data-testid={`legend-${id}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}
        >
          <div style={swatchStyle as React.CSSProperties} />
          {label}
        </div>
      ))}
    </div>
  )
}
