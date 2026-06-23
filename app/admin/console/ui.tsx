'use client';

// Operations-console building blocks: badge, copyable id, data table, drawer,
// toolbar controls, confirm action, toasts, skeletons, empty states, field
// rows. Every resource panel composes these so the console renders one
// consistent system. Styling lives in ../console.css (scoped under .rg-console).

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
  CSSProperties,
} from 'react';

// ── Date / value formatting ──────────────────────────────────────────────────

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function fmtMoney(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return `S/ ${value}`;
}

// ── Status badge ─────────────────────────────────────────────────────────────

type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'info';

// Map every backend status (orders / tickets / events) to a badge tone + label.
const STATUS_TONE: Record<string, Tone> = {
  paid: 'ok', valid: 'ok', published: 'ok', active: 'ok',
  pending: 'warn', draft: 'warn',
  expired: 'bad', void: 'bad', cancelled: 'bad', canceled: 'bad',
  comp: 'neutral',
  used: 'info',
};

const STATUS_LABEL: Record<string, string> = {
  paid: 'Pagada', valid: 'Válida', published: 'Publicado', draft: 'Borrador',
  pending: 'Pendiente', expired: 'Expirada', void: 'Anulada',
  cancelled: 'Cancelada', canceled: 'Cancelada', comp: 'Cortesía', used: 'Usada',
};

const SR_ONLY: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return (
    <span className="rg-badge" data-tone={tone} data-status={status}>
      {STATUS_LABEL[status] ?? status}
      {/* Raw status kept readable to assistive tech + the e2e contract, which
          asserts on the canonical English status string. */}
      <span style={SR_ONLY}>{status}</span>
    </span>
  );
}

// ── Copyable id / token ──────────────────────────────────────────────────────

export function CopyId({ value, label }: { value: string | null | undefined; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="rg-empty">—</span>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard may be unavailable (insecure context) — fail silently.
    }
  }

  return (
    <button type="button" className="rg-copy" data-copied={copied} onClick={copy}
      title={`Copiar ${label || 'valor'}`} aria-label={`Copiar ${label || value}`}>
      <span className="rg-copy-text">{value}</span>
      <span className="rg-copy-icon" aria-hidden>
        {copied ? <IconCheck /> : <IconCopy />}
      </span>
    </button>
  );
}

// ── Toolbar primitives ───────────────────────────────────────────────────────

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="rg-toolbar">{children}</div>;
}

export function SearchBox({
  value, onChange, placeholder, testId,
}: { value: string; onChange: (v: string) => void; placeholder: string; testId: string }) {
  return (
    <div className="rg-search">
      <IconSearch />
      <input
        type="search"
        data-testid={testId}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}

export function Select({
  value, onChange, testId, children, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  testId: string;
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <select className="rg-select" data-testid={testId} value={value}
      onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
      {children}
    </select>
  );
}

export function Segmented<T extends string>({
  options, value, onChange, testId,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testId: string;
}) {
  return (
    <div className="rg-segmented" role="tablist" data-testid={testId}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button key={opt.key} type="button" role="tab" aria-selected={active}
            data-testid={`${testId}-${opt.key}`} data-active={active}
            onClick={() => onChange(opt.key)}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  variant = 'secondary', small, children, ...rest
}: {
  variant?: BtnVariant;
  small?: boolean;
  'data-testid'?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `rg-btn rg-btn-${variant}${small ? ' rg-btn-sm' : ''}`;
  return <button type="button" {...rest} className={cls}>{children}</button>;
}

// ── Data table ───────────────────────────────────────────────────────────────

export interface Column<Row> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  // Optional fixed width hint for the column.
  width?: string;
  render: (row: Row) => ReactNode;
}

export function DataTable<Row>({
  columns, rows, rowKey, onRowClick, rowTestId, loading, empty, skeletonRows = 6,
}: {
  columns: Column<Row>[];
  rows: Row[] | null;
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  rowTestId?: string;
  loading?: boolean;
  empty?: ReactNode;
  skeletonRows?: number;
}) {
  if (rows === null || loading) {
    return (
      <div className="rg-table-wrap" aria-busy="true">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="rg-skel rg-skel-row" style={{ width: `${90 - (i % 4) * 14}%` }} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="rg-table-wrap">{empty ?? <EmptyState title="Sin resultados" />}</div>;
  }

  return (
    <div className="rg-table-wrap">
      <table className="rg-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align ?? 'left', width: c.width }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              data-testid={rowTestId}
              data-clickable={onRowClick ? 'true' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
              } : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} data-label={c.header || undefined}
                  data-empty-header={c.header ? undefined : 'true'}
                  style={{ textAlign: c.align ?? 'left' }}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

export function Drawer({
  open, onClose, title, subtitle, testId, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  testId?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Esc closes; lock body scroll while open so the page behind doesn't move.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="rg-drawer-overlay" onClick={onClose} aria-hidden />
      <aside className="rg-drawer" role="dialog" aria-modal="true" data-testid={testId}
        aria-label={typeof title === 'string' ? title : 'Detalle'}>
        <div className="rg-drawer-head">
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <div className="rg-drawer-sub">{subtitle}</div>}
          </div>
          <button type="button" className="rg-drawer-close" data-testid="drawer-close"
            onClick={onClose} aria-label="Cerrar">
            <IconX />
          </button>
        </div>
        <div className="rg-drawer-body">{children}</div>
        {footer && <div className="rg-drawer-foot">{footer}</div>}
      </aside>
    </>
  );
}

// Label / value field row + list — the signature element of a detail drawer.
export function FieldList({ children }: { children: ReactNode }) {
  return <dl className="rg-fieldlist">{children}</dl>;
}

export function Field({
  label, children, mono, copy,
}: {
  label: string;
  children?: ReactNode;
  mono?: boolean;
  copy?: string | null;
}) {
  const empty = children == null || children === '' || children === '—';
  return (
    <div className="rg-fieldrow">
      <dt>{label}</dt>
      <dd className={empty ? 'rg-empty' : undefined}>
        {copy != null
          ? <CopyId value={copy} label={label} />
          : mono
            ? <span className="rg-mono">{empty ? '—' : children}</span>
            : (empty ? '—' : children)}
      </dd>
    </div>
  );
}

export function DrawerSectionTitle({ children }: { children: ReactNode }) {
  return <div className="rg-drawer-section-title">{children}</div>;
}

// ── Confirm action (destructive, inline two-step) ────────────────────────────

export function ConfirmAction({
  label, confirmLabel, prompt, onConfirm, testId, busy, asButton = true,
}: {
  label: string;
  confirmLabel: string;
  prompt: string;
  onConfirm: () => void | Promise<void>;
  testId: string;
  busy?: boolean;
  asButton?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" data-testid={testId} onClick={() => setConfirming(true)}
        className={asButton ? 'rg-btn rg-btn-danger rg-btn-sm' : 'rg-link'}
        style={asButton ? undefined : { color: 'var(--bad-fg)' }}>
        {label}
      </button>
    );
  }

  return (
    <span className="rg-confirm">
      <span className="rg-confirm-prompt">{prompt}</span>
      <button type="button" data-testid={`${testId}-confirm`} disabled={busy}
        className="rg-btn rg-btn-sm" style={{ background: 'var(--bad-fg)', color: '#fff' }}
        onClick={async () => { await onConfirm(); setConfirming(false); }}>
        {confirmLabel}
      </button>
      <button type="button" className="rg-link" style={{ color: 'var(--muted)' }}
        onClick={() => setConfirming(false)}>Cancelar</button>
    </span>
  );
}

// ── Inline feedback banner (keeps feedback-ok / feedback-error selectors) ─────

export function Feedback({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p className="rg-feedback" data-kind={kind} data-testid={`feedback-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({
  title, description, icon, action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rg-empty-state" data-testid="empty-state">
      {icon ?? <IconInbox />}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

// ── Toasts ───────────────────────────────────────────────────────────────────

export interface Toast { id: number; kind: 'ok' | 'error'; message: string; }

let toastSeq = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback((kind: 'ok' | 'error', message: string) => {
    const id = ++toastSeq;
    setToasts((cur) => [...cur, { id, kind, message }]);
    timers.current[id] = setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="rg-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="rg-toast" data-kind={t.kind}
          data-testid={`toast-${t.kind}`} role="status"
          onClick={() => onDismiss(t.id)}>
          <span className="rg-toast-icon" aria-hidden>{t.kind === 'ok' ? <IconCheck /> : <IconAlert />}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Icons (16px line, currentColor) ──────────────────────────────────────────

const ic: CSSProperties = { display: 'block' };
function svg(path: ReactNode, size = 16) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={ic} aria-hidden>
      {path}
    </svg>
  );
}

export const IconSearch = () => svg(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>, 15);
export const IconCopy = () => svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>, 13);
export const IconCheck = () => svg(<path d="M20 6L9 17l-5-5" />, 14);
export const IconX = () => svg(<path d="M18 6L6 18M6 6l12 12" />, 16);
export const IconAlert = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>, 14);
export const IconInbox = () => svg(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5 5h14l3 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></>, 28);
export const IconPlus = () => svg(<path d="M12 5v14M5 12h14" />, 15);
export const IconMenu = () => svg(<path d="M3 6h18M3 12h18M3 18h18" />, 18);

// Resource nav icons.
export const IconCalendar = () => svg(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>, 16);
export const IconReceipt = () => svg(<><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2z" /><path d="M9 7h6M9 11h6" /></>, 16);
export const IconTicket = () => svg(<><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" /><path d="M13 5v14" /></>, 16);
export const IconMusic = () => svg(<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>, 16);
export const IconList = () => svg(<><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>, 16);
export const IconTag = () => svg(<><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>, 16);
export const IconSend = () => svg(<><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>, 16);
export const IconLogout = () => svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>, 16);
