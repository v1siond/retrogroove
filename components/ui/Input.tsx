import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, ...props }: InputProps) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    outline: 'none',
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
      <input id={id} style={inputStyle} {...props} />
    </div>
  )
}
