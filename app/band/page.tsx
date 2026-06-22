'use client';

// /band is the legacy entry point. The single admin now lives at /band/tickets,
// so redirect there. Static export has no server, so this is a client redirect.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BandRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/band/tickets');
  }, [router]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <p>
        Redirigiendo al panel…{' '}
        <a href="/band/tickets" style={{ color: 'var(--color-cyan)', textDecoration: 'underline' }}>
          ir ahora
        </a>
      </p>
    </main>
  );
}
