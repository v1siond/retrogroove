'use client';

// Operations console shell: a fixed dark left sidebar for resource navigation +
// a light content area with a top bar. Each resource is a self-contained panel
// that owns its toolbar, data table, and detail drawer. The shell owns the
// active resource, the global search term (passed to the active panel), and the
// chrome. Login is handled by AdminGate wrapping the page.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { clearToken } from '@/lib/ticketing/admin';
import './console.css';
import {
  IconCalendar, IconReceipt, IconTicket, IconMusic, IconList, IconTag,
  IconSend, IconLogout, IconMenu, IconSearch, IconX,
} from './console/ui';
import EventsPanel from './panels/EventsPanel';
import OrdersPanel from './panels/OrdersPanel';
import TicketsPanel from './panels/TicketsPanel';
import SongsPanel from './panels/SongsPanel';
import SetlistsPanel from './panels/SetlistsPanel';
import PromosPanel from './panels/PromosPanel';
import IssuePanel from './panels/IssuePanel';

type Resource = 'events' | 'orders' | 'tickets' | 'songs' | 'setlists' | 'promos' | 'issue';

interface PanelProps { query: string }

interface NavEntry {
  key: Resource;
  label: string;
  icon: React.ComponentType;
  Panel: React.ComponentType<PanelProps>;
}

// Order matches the spec's sidebar: resources, then a divider, then Emitir.
const PRIMARY: NavEntry[] = [
  { key: 'events', label: 'Eventos', icon: IconCalendar, Panel: EventsPanel },
  { key: 'orders', label: 'Órdenes', icon: IconReceipt, Panel: OrdersPanel },
  { key: 'tickets', label: 'Entradas', icon: IconTicket, Panel: TicketsPanel },
  { key: 'songs', label: 'Canciones', icon: IconMusic, Panel: SongsPanel },
  { key: 'setlists', label: 'Setlists', icon: IconList, Panel: SetlistsPanel },
  { key: 'promos', label: 'Códigos', icon: IconTag, Panel: PromosPanel },
];

const SECONDARY: NavEntry[] = [
  { key: 'issue', label: 'Emitir entradas', icon: IconSend, Panel: IssuePanel },
];

const ALL = [...PRIMARY, ...SECONDARY];
const TITLES: Record<Resource, string> = {
  events: 'Eventos', orders: 'Órdenes', tickets: 'Entradas', songs: 'Canciones',
  setlists: 'Setlists', promos: 'Códigos promocionales', issue: 'Emitir entradas',
};

function NavButton({ entry, active, onClick }: { entry: NavEntry; active: boolean; onClick: () => void }) {
  const Icon = entry.icon;
  return (
    <button type="button" className="rg-nav-item" data-testid={`nav-${entry.key}`}
      data-active={active} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <Icon />
      {entry.label}
    </button>
  );
}

export default function Dashboard() {
  const [active, setActive] = useState<Resource>('events');
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const entry = ALL.find((e) => e.key === active)!;
  const Panel = entry.Panel;

  // Lock body scroll while the off-canvas sidebar is open so the page behind
  // stays put; always restore on close/unmount (no stuck scroll lock).
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  function go(key: Resource) {
    setActive(key);
    setQuery('');
    setMobileOpen(false);
  }

  function logout() {
    clearToken();
    window.location.reload();
  }

  return (
    <div className={`rg-console ${GeistSans.variable} ${GeistMono.variable}`}>
      <div className="rg-shell">
        {/* Mobile backdrop */}
        <div className="rg-mobile-backdrop" data-open={mobileOpen} onClick={() => setMobileOpen(false)} aria-hidden />

        {/* Sidebar */}
        <nav className="rg-sidebar" data-open={mobileOpen} data-testid="admin-nav" aria-label="Recursos">
          <button type="button" className="rg-sidebar-close" aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}>
            <IconX />
          </button>
          <Link href="/" className="rg-wordmark">
            <span className="rg-wordmark-dot">R</span>
            RetroGroove
          </Link>

          <div className="rg-nav">
            {PRIMARY.map((e) => (
              <NavButton key={e.key} entry={e} active={active === e.key} onClick={() => go(e.key)} />
            ))}

            <div className="rg-nav-section">Operaciones</div>
            {SECONDARY.map((e) => (
              <NavButton key={e.key} entry={e} active={active === e.key} onClick={() => go(e.key)} />
            ))}
          </div>

          <div className="rg-nav-spacer" />
          <button type="button" className="rg-nav-item" data-testid="admin-logout" onClick={logout}>
            <IconLogout />
            Salir
          </button>
        </nav>

        {/* Content */}
        <div className="rg-content">
          <header className="rg-topbar">
            <button type="button" className="rg-hamburger" aria-label="Abrir menú"
              onClick={() => setMobileOpen((o) => !o)}>
              {mobileOpen ? <IconX /> : <IconMenu />}
            </button>
            <span className="rg-topbar-title">{TITLES[active]}</span>

            <div className="rg-topbar-search">
              <IconSearch />
              <input type="search" data-testid="global-search" placeholder="Buscar…"
                value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar" />
            </div>

            <div className="rg-account">
              <span className="rg-avatar" aria-hidden>RG</span>
            </div>
          </header>

          <main className="rg-main">
            {/* Remount the panel per resource so its internal state (filters,
                selected row) resets cleanly when switching. */}
            <Panel key={active} query={query} />
          </main>
        </div>
      </div>
    </div>
  );
}
