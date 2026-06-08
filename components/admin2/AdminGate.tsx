'use client';

import { useEffect, useState, FormEvent, ReactNode } from 'react';
import { adminApi, getToken, setToken } from '@/lib/ticketing/admin';
import { ui } from '@/lib/ticketing/ui';

export function AdminGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(!!getToken());
    setReady(true);
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await adminApi.login(email, password);
      setToken(token);
      setAuthed(true);
    } catch {
      setError('Credenciales inválidas');
    }
  }

  if (!ready) return null;

  if (!authed) {
    return (
      <main className={`${ui.page} max-w-md`}>
        <h1 className={ui.h1}>RetroGroove Admin</h1>
        {error && <p className={ui.error} role="alert">{error}</p>}
        <form onSubmit={login}>
          <label className={ui.label} htmlFor="admin-email">Email</label>
          <input id="admin-email" type="email" className={ui.input} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className={ui.label} htmlFor="admin-password">Contraseña</label>
          <input id="admin-password" type="password" className={ui.input} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div><button type="submit" className={ui.btn}>Entrar</button></div>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
