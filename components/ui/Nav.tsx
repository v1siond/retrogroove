import Link from 'next/link'

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
      gap: '12px',
      padding: '14px clamp(16px, 5vw, 28px)',
      background: 'rgba(8,2,14,0.78)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <span
        data-testid="nav-brand"
        style={{
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.16em',
          fontSize: 'clamp(1.2rem, 4.5vw, 1.4rem)',
          whiteSpace: 'nowrap',
          background: 'linear-gradient(90deg, var(--color-pink), var(--color-purple), var(--color-cyan))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {brand}
      </span>
      <div style={{ display: 'flex', gap: 'clamp(16px, 5vw, 22px)', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none', padding: '6px 0' }}>Inicio</Link>
        <Link href="/admin" style={{ color: 'inherit', textDecoration: 'none', padding: '6px 0' }}>Admin</Link>
      </div>
    </nav>
  )
}
