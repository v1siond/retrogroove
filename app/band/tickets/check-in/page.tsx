'use client';

import { useRef, useState, FormEvent } from 'react';
import { AdminGate } from '@/components/admin2/AdminGate';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import type { Ticket } from '@/lib/ticketing/types';

type Result = 'valid' | 'used' | 'invalid' | 'notfound' | 'checked' | null;

function CheckIn() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [token, setTokenValue] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [count, setCount] = useState(0);
  const [working, setWorking] = useState(false);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setWorking(true);
    setTicket(null);
    setResult(null);
    try {
      const { ticket } = await adminApi.getTicket(token.trim());
      setTicket(ticket);
      setResult(ticket.status === 'used' ? 'used' : ticket.status === 'valid' ? 'valid' : 'invalid');
    } catch {
      setResult('notfound');
    } finally {
      setWorking(false);
    }
  }

  async function doCheckIn() {
    if (!ticket?.public_token) return;
    setWorking(true);
    try {
      const { ticket: used } = await adminApi.checkIn(ticket.public_token);
      setTicket(used);
      setResult('checked');
      setCount((c) => c + 1);
    } catch (err) {
      const data = (err as ApiError)?.data as { reason?: string } | undefined;
      setResult(data?.reason === 'already_used' ? 'used' : 'invalid');
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    setTokenValue('');
    setTicket(null);
    setResult(null);
    inputRef.current?.focus();
  }

  const label: Record<Exclude<Result, null>, string> = {
    valid: 'Válida',
    used: 'Ya usada',
    invalid: 'Inválida',
    notfound: 'No encontrada',
    checked: 'Entrada registrada',
  };

  return (
    <main className="checkin">
      <h1>Check-in</h1>
      <p data-testid="count">{count === 1 ? '1 entrada' : `${count} entradas`} hoy</p>

      <form onSubmit={lookup}>
        <input
          ref={inputRef}
          placeholder="Código o token del ticket"
          value={token}
          onChange={(e) => setTokenValue(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={working}>Verificar</button>
      </form>

      {result && (
        <div className="result" data-testid="result" data-result={result}>
          <p>{label[result]}</p>
          {result === 'valid' && (
            <button type="button" onClick={doCheckIn} disabled={working}>Registrar entrada</button>
          )}
          {result !== 'valid' && (
            <button type="button" onClick={reset}>Siguiente</button>
          )}
        </div>
      )}
    </main>
  );
}

export default function CheckInPage() {
  return (
    <AdminGate>
      <CheckIn />
    </AdminGate>
  );
}
