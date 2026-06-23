'use client';

import { AdminGate } from '@/components/admin2/AdminGate';
import { ConsoleShell } from '../ConsoleShell';
import SetlistsPanel from '../panels/SetlistsPanel';

export default function AdminSetlistsPage() {
  return (
    <AdminGate>
      <ConsoleShell active="setlists">
        <SetlistsPanel query="" />
      </ConsoleShell>
    </AdminGate>
  );
}
