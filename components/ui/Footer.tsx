export function Footer() {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '40px 24px 20px',
      borderTop: '1px solid var(--color-border)',
    }}>
      <div
        data-testid="footer-brand"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          letterSpacing: '0.15em',
          color: 'var(--color-text-muted)',
          marginBottom: '8px',
        }}
      >
        RETROGROOVE
      </div>
      <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-text-faint)' }}>
        Que no pare la música
      </div>
    </footer>
  )
}
