interface NavProps {
  brand?: string
}

export function Nav({ brand = 'RETROGROOVE' }: NavProps) {
  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 28px',
      background: 'rgba(8,2,14,0.78)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <span
        data-testid="nav-brand"
        style={{
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.16em',
          fontSize: '1.4rem',
          background: 'linear-gradient(90deg, var(--color-pink), var(--color-purple), var(--color-cyan))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {brand}
      </span>
      <div style={{ display: 'flex', gap: '22px', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
        <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Inicio</a>
        <a href="/band/tickets/nuevo" style={{ color: 'inherit', textDecoration: 'none' }}>Admin</a>
      </div>
    </nav>
  )
}
