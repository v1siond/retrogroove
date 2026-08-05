'use client';

import { AdminGate } from '@/components/admin2/AdminGate';
import { ConsoleShell } from '../ConsoleShell';
import EquipmentPanel from '../panels/EquipmentPanel';

export default function AdminEquipmentPage() {
  return (
    <AdminGate>
      <ConsoleShell active="equipment">
        <EquipmentPanel query="" />
      </ConsoleShell>
    </AdminGate>
  );
}
