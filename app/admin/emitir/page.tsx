'use client';

import { AdminGate } from '@/components/admin2/AdminGate';
import { ConsoleShell } from '../ConsoleShell';
import IssuePanel from '../panels/IssuePanel';

export default function AdminIssuePage() {
  return (
    <AdminGate>
      <ConsoleShell active="issue">
        <IssuePanel query="" />
      </ConsoleShell>
    </AdminGate>
  );
}
