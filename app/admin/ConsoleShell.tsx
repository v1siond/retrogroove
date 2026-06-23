'use client';

// The admin console shell: a fixed dark sidebar (resource nav as real /admin/* links) +
// a content area with a top bar. Each resource is its own route that renders its panel
// inside this shell with the matching `active` key — so the URL changes and deep links work.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { clearToken } from '@/lib/ticketing/admin';
import './console.css';
import {
  IconCalendar, IconReceipt, IconTicket, IconMusic, IconList, IconTag,
  IconSend, IconLogout, IconMenu, IconX,
} from './console/ui';

export type Resource = 'events' | 'orders' | 'tickets' | 'songs' | 'setlists' | 'promos' | 'issue';

interface NavEntry {
  key: Resource;
  label: string;
  href: string;
  icon: React.ComponentType;
}

const PRIMARY: NavEntry[] = [
  { key: 'events', label: 'Eventos', href: '/admin', icon: IconCalendar },
  { key: 'orders', label: 'Órdenes', href: '/admin/orders', icon: IconReceipt },
  { key: 'tickets', label: 'Entradas', href: '/admin/tickets', icon: IconTicket },
  { key: 'songs', label: 'Canciones', href: '/admin/songs', icon: IconMusic },
  { key: 'setlists', label: 'Setlists', href: '/admin/setlists', icon: IconList },
  { key: 'promos', label: 'Códigos', href: '/admin/promos', icon: IconTag },
];

const SECONDARY: NavEntry[] = [
  { key: 'issue', label: 'Emitir entradas', href: '/admin/emitir', icon: IconSend },
];

const TITLES: Record<Resource, string> = {
  events: 'Eventos', orders: 'Órdenes', tickets: 'Entradas', songs: 'Canciones',
  setlists: 'Setlists', promos: 'Códigos promocionales', issue: 'Emitir entradas',
};

function NavLink({ entry, active }: { entry: NavEntry; active: boolean }) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      className="rg-nav-item"
      data-testid={`nav-${entry.key}`}
      data-active={active}
      aria-current={active ? 'page' : undefined}
    >
      <Icon />
      {entry.label}
    </Link>
  );
}

export function ConsoleShell({ active, children }: { active: Resource; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  function logout() {
    clearToken();
    window.location.href = '/admin';
  }

  return (
    <div className={`rg-console ${GeistSans.variable} ${GeistMono.variable}`}>
      <div className="rg-shell">
        <div className="rg-mobile-backdrop" data-open={mobileOpen} onClick={() => setMobileOpen(false)} aria-hidden />

        <nav className="rg-sidebar" data-open={mobileOpen} data-testid="admin-nav" aria-label="Recursos">
          <button type="button" className="rg-sidebar-close" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}>
            <IconX />
          </button>
          <Link href="/" className="rg-wordmark">
            <span className="rg-wordmark-dot">R</span>
            RetroGroove
          </Link>

          <div className="rg-nav">
            {PRIMARY.map((e) => <NavLink key={e.key} entry={e} active={active === e.key} />)}
            <div className="rg-nav-section">Operaciones</div>
            {SECONDARY.map((e) => <NavLink key={e.key} entry={e} active={active === e.key} />)}
          </div>

          <div className="rg-nav-spacer" />
          <button type="button" className="rg-nav-item" data-testid="admin-logout" onClick={logout}>
            <IconLogout />
            Salir
          </button>
        </nav>

        <div className="rg-content">
          <header className="rg-topbar">
            <button type="button" className="rg-hamburger" aria-label="Abrir menú" onClick={() => setMobileOpen((o) => !o)}>
              {mobileOpen ? <IconX /> : <IconMenu />}
            </button>
            <span className="rg-topbar-title">{TITLES[active]}</span>
            <div className="rg-account">
              <span className="rg-avatar" aria-hidden>RG</span>
            </div>
          </header>

          <main className="rg-main">{children}</main>
        </div>
      </div>
    </div>
  );
}
