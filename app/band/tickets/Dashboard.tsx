'use client';

// Admin dashboard shell: a persistent left/top nav across every resource —
// Events, Orders, Tickets, Songs, Setlists — so staff can list and act on
// tickets and orders globally, not only by drilling into one event. Each
// resource is a self-contained panel; the shell just owns the active tab and
// the chrome (login already handled by the AdminGate wrapping this page).

import { useState } from 'react';
import Link from 'next/link';
import { clearToken } from '@/lib/ticketing/admin';
import EventsPanel from './panels/EventsPanel';
import OrdersPanel from './panels/OrdersPanel';
import TicketsPanel from './panels/TicketsPanel';
import SongsPanel from './panels/SongsPanel';
import SetlistsPanel from './panels/SetlistsPanel';

type Resource = 'events' | 'orders' | 'tickets' | 'songs' | 'setlists';

const TABS: { key: Resource; label: string }[] = [
  { key: 'events', label: 'Eventos' },
  { key: 'orders', label: 'Órdenes' },
  { key: 'tickets', label: 'Entradas' },
  { key: 'songs', label: 'Canciones' },
  { key: 'setlists', label: 'Setlists' },
];

const PANELS: Record<Resource, React.ComponentType> = {
  events: EventsPanel,
  orders: OrdersPanel,
  tickets: TicketsPanel,
  songs: SongsPanel,
  setlists: SetlistsPanel,
};

export default function Dashboard() {
  const [active, setActive] = useState<Resource>('events');
  const Panel = PANELS[active];

  function logout() {
    clearToken();
    window.location.reload();
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      {/* Top bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(8,2,14,.82)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.08em', textDecoration: 'none', color: 'var(--color-text)', textShadow: '0 0 10px rgba(255,20,147,.4)' }}>
            RETROGROOVE
          </Link>
          <span style={{ fontSize: '0.66rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-cyan)', fontWeight: 600 }}>Admin</span>

          <nav data-testid="admin-nav" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                data-testid={`nav-${t.key}`}
                data-active={active === t.key}
                onClick={() => setActive(t.key)}
                style={{
                  padding: '7px 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontSize: '0.95rem', letterSpacing: '0.04em',
                  border: '1px solid', transition: 'all 0.15s',
                  ...(active === t.key
                    ? { background: 'var(--color-pink)', borderColor: 'var(--color-pink)', color: '#fff' }
                    : { background: 'transparent', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }),
                }}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              data-testid="admin-logout"
              onClick={logout}
              style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-faint)', fontSize: '0.8rem' }}
            >
              Salir
            </button>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: '64rem', margin: '0 auto', padding: '20px' }}>
        <Panel />
      </main>
    </div>
  );
}
