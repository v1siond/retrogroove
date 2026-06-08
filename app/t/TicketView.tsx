'use client';

import { useEffect, useState } from 'react';
import { ticketingApi } from '@/lib/ticketing/api';
import type { Ticket } from '@/lib/ticketing/types';

export default function TicketView({ token }: { token: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ticketingApi
      .getTicket(token)
      .then((r) => setTicket(r.ticket))
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <main className="ticket"><p>Cargando...</p></main>;
  if (!ticket) return <main className="ticket"><p>Entrada no encontrada</p></main>;

  return (
    <main className="ticket">
      <h1>Tu Entrada</h1>
      <p data-testid="ticket-status">{ticket.status === 'used' ? 'Usada' : 'Válida'}</p>
      {ticket.code && <p className="code">Código: {ticket.code}</p>}
      {ticket.qr_svg && (
        <div className="qr" data-testid="ticket-qr" dangerouslySetInnerHTML={{ __html: ticket.qr_svg }} />
      )}
      <button type="button" onClick={() => window.print()}>Imprimir</button>
    </main>
  );
}
