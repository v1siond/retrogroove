'use client';

import { AdminGate } from '@/components/admin2/AdminGate';
import { ConsoleShell } from '../ConsoleShell';
import SongsPanel from '../panels/SongsPanel';

export default function AdminSongsPage() {
  return (
    <AdminGate>
      <ConsoleShell active="songs">
        <SongsPanel query="" />
      </ConsoleShell>
    </AdminGate>
  );
}
