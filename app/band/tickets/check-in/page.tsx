'use client';

import { useRef, useState, FormEvent } from 'react';
import { AdminGate } from '@/components/admin2/AdminGate';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
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
  const good = result === 'valid' || result === 'checked';

  return (
    <main className={`${ui.page} max-w-xl`}>
      <h1 className={ui.h1}>Check-in</h1>
      <p data-testid="count" className="text-[#00e5ff]">
        {count === 1 ? '1 entrada' : `${count} entradas`} hoy
      </p>

      <form onSubmit={lookup} className="flex gap-2 items-end mt-4">
        <input
          ref={inputRef}
          className={`${ui.input} flex-1`}
          placeholder="Código o token del ticket"
          value={token}
          onChange={(e) => setTokenValue(e.target.value)}
          autoFocus
        />
        <button type="submit" className={ui.btn} disabled={working}>Verificar</button>
      </form>

      {result && (
        <div className={ui.card} data-testid="result" data-result={result}>
          <p className={`text-xl font-bold ${good ? 'text-[#22c55e]' : 'text-[#ff5a6e]'}`}>{label[result]}</p>
          {result === 'valid' && (
            <button type="button" className={ui.btn} onClick={doCheckIn} disabled={working}>Registrar entrada</button>
          )}
          {result !== 'valid' && (
            <button type="button" className={ui.btnGhost} onClick={reset}>Siguiente</button>
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
