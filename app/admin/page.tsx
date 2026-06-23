'use client';

import { AdminGate } from '@/components/admin2/AdminGate';
import { ConsoleShell } from './ConsoleShell';
import EventsPanel from './panels/EventsPanel';

export default function AdminEventsPage() {
  return (
    <AdminGate>
      <ConsoleShell active="events">
        <EventsPanel query="" />
      </ConsoleShell>
    </AdminGate>
  );
}
