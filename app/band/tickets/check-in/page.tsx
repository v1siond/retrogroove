'use client';

import { Suspense, useEffect, useRef, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminGate } from '@/components/admin2/AdminGate';
import { adminApi, ApiError } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';
import type { Ticket } from '@/lib/ticketing/types';

type Result = 'valid' | 'used' | 'invalid' | 'notfound' | 'checked' | null;

function CheckIn({ scannedToken }: { scannedToken: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [token, setTokenValue] = useState(scannedToken);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [count, setCount] = useState(0);
  const [working, setWorking] = useState(false);

  async function runLookup(raw: string) {
    const tok = raw.trim();
    if (!tok) return;
    setWorking(true);
    setTicket(null);
    setResult(null);
    try {
      const { ticket } = await adminApi.getTicket(tok);
      setTicket(ticket);
      setResult(ticket.status === 'used' ? 'used' : ticket.status === 'valid' ? 'valid' : 'invalid');
    } catch {
      setResult('notfound');
    } finally {
      setWorking(false);
    }
  }

  function lookup(e: FormEvent) {
    e.preventDefault();
    void runLookup(token);
  }

  // A QR scan opens this page with ?token=… — auto-verify it (manual entry is the fallback).
  useEffect(() => {
    if (scannedToken) {
      setTokenValue(scannedToken);
      void runLookup(scannedToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedToken]);

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
      <p className="text-white/50 text-sm">Escanea el QR del ticket, o ingresa el código manualmente.</p>

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

function CheckInScreen() {
  const scannedToken = useSearchParams().get('token') || '';
  return (
    <AdminGate>
      <CheckIn scannedToken={scannedToken} />
    </AdminGate>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={null}>
      <CheckInScreen />
    </Suspense>
  );
}
