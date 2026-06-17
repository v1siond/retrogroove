import React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  children: React.ReactNode
}

export function Select({ label, id, children, ...props }: SelectProps) {
  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
    marginBottom: '6px',
  }

  return (
    <div>
      {label && <label htmlFor={id} style={labelStyle}>{label}</label>}
      <select id={id} style={selectStyle} {...props}>{children}</select>
    </div>
  )
}
