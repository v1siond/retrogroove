'use client';

import { AdminGate } from '@/components/admin2/AdminGate';
import Dashboard from './Dashboard';

export default function TicketsDashboardPage() {
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}
