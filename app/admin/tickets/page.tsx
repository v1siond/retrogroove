'use client';

import { AdminGate } from '@/components/admin2/AdminGate';
import { ConsoleShell } from '../ConsoleShell';
import TicketsPanel from '../panels/TicketsPanel';

export default function AdminTicketsPage() {
  return (
    <AdminGate>
      <ConsoleShell active="tickets">
        <TicketsPanel query="" />
      </ConsoleShell>
    </AdminGate>
  );
}
