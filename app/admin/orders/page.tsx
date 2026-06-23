'use client';

import { AdminGate } from '@/components/admin2/AdminGate';
import { ConsoleShell } from '../ConsoleShell';
import OrdersPanel from '../panels/OrdersPanel';

export default function AdminOrdersPage() {
  return (
    <AdminGate>
      <ConsoleShell active="orders">
        <OrdersPanel query="" />
      </ConsoleShell>
    </AdminGate>
  );
}
