'use client';

import { useEffect, useState } from 'react';
import { ticketingApi } from '@/lib/ticketing/api';
import { ui } from '@/lib/ticketing/ui';
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

  if (loading) return <main className={`${ui.page} text-center`}><p>Cargando...</p></main>;
  if (!ticket) return <main className={`${ui.page} text-center`}><p>Entrada no encontrada</p></main>;

  return (
    <main className={`${ui.page} text-center`}>
      <h1 className={ui.h1}>Tu Entrada</h1>
      <p data-testid="ticket-status" className={`text-xl font-semibold ${ticket.status === 'used' ? 'text-[#ff5a6e]' : 'text-[#22c55e]'}`}>
        {ticket.status === 'used' ? 'Usada' : 'Válida'}
      </p>
      {ticket.qr_svg && (
        <div
          className="inline-block bg-white p-4 rounded-xl my-4 max-w-[280px] [&_svg]:w-full [&_svg]:h-auto"
          data-testid="ticket-qr"
          dangerouslySetInnerHTML={{ __html: ticket.qr_svg }}
        />
      )}
      <p className="text-white/60 text-sm">Escanea el QR en la puerta, o usa el código:</p>
      <p data-testid="ticket-token" className="font-[Bebas_Neue] tracking-[0.35em] text-[#ffd700] text-2xl mt-1">
        {ticket.public_token}
      </p>
      <div className="mt-4">
        <button type="button" className={ui.btn} onClick={() => window.print()}>Imprimir</button>
      </div>
    </main>
  );
}
