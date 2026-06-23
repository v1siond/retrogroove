'use client';

import { AdminGate } from '@/components/admin2/AdminGate';
import { ConsoleShell } from '../ConsoleShell';
import PromosPanel from '../panels/PromosPanel';

export default function AdminPromosPage() {
  return (
    <AdminGate>
      <ConsoleShell active="promos">
        <PromosPanel query="" />
      </ConsoleShell>
    </AdminGate>
  );
}
