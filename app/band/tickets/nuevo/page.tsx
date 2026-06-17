'use client';

import { useState, FormEvent, MouseEvent, useRef } from 'react';
import Link from 'next/link';
import { AdminGate } from '@/components/admin2/AdminGate';
import { adminApi } from '@/lib/ticketing/admin';

// ── Types ────────────────────────────────────────────────────────────────────

interface TarifaRow {
  quantity: number;
  price: string;
}

interface TableDef {
  id: string;
  label: string;
  /** pos_x as % of canvas width */
  pos_x: number;
  /** pos_y as % of canvas height */
  pos_y: number;
  /** diameter in px at canvas reference size */
  size: number;
  shape: 'round' | 'rect';
  seat_count: number;
  seating: 'around' | 'rows';
}

interface SectionDef {
  id: string;
  name: string;
  layout_type: 'tables' | 'general';
  capacity: number;
  tarifas: TarifaRow[];
  tables: TableDef[];
}

const SECTION_COLORS = ['#ff1493', '#00e5ff', '#ffd700', '#bf00ff', '#22c55e', '#ff8c00'];

const SNAP = 28; // grid cell px — matches the CSS repeating-linear-gradient pitch

function snapVal(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

// ── CSS helpers (Neon-Editorial tokens; all inline styles) ───────────────────

const S = {
  // overall layout
  wrap: {
    minHeight: '100vh',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-body)',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  // top bar
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 22px',
    borderBottom: '1px solid rgba(255,255,255,.1)',
    background: 'var(--color-bg)',
  },
  topTitle: {
    fontFamily: 'var(--font-display)',
    letterSpacing: '.04em',
    fontSize: '1.4rem',
    textShadow: '0 0 8px #fff, 0 0 22px var(--color-pink)',
    color: 'var(--color-text)',
  },
  publishBtn: {
    background: 'linear-gradient(135deg,var(--color-pink),var(--color-purple))',
    color: '#fff',
    padding: '10px 22px',
    borderRadius: '999px',
    fontFamily: 'var(--font-display)',
    letterSpacing: '.05em',
    fontSize: '1rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 0 18px rgba(255,20,147,.4)',
  },
  // stage wrap
  stageWrap: {
    display: 'flex',
    flex: 1,
    minHeight: '560px',
  },
  // left panel
  panel: {
    width: '300px',
    flexShrink: 0,
    borderRight: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(255,255,255,.03)',
    padding: '16px',
    overflowY: 'auto' as const,
  },
  eyebrow: {
    fontSize: '.58rem',
    letterSpacing: '.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-cyan)',
    fontWeight: 600,
    margin: '12px 0 6px',
  },
  fieldInput: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '9px',
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.1)',
    color: 'var(--color-text)',
    fontSize: '.78rem',
    outline: 'none',
    marginTop: '4px',
    boxSizing: 'border-box' as const,
  },
  fieldInputFocus: {
    borderColor: 'var(--color-cyan)',
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '7px',
    marginTop: '7px',
  },
  // section tabs
  tabs: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap' as const,
    margin: '6px 0 10px',
  },
  tabActive: {
    fontSize: '.7rem',
    padding: '5px 12px',
    borderRadius: '999px',
    border: '1px solid var(--color-pink)',
    background: 'var(--color-pink)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabInactive: {
    fontSize: '.7rem',
    padding: '5px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,.1)',
    color: 'rgba(236,230,240,.62)',
    cursor: 'pointer',
    background: 'none',
  },
  tabAdd: {
    fontSize: '.7rem',
    padding: '5px 12px',
    borderRadius: '999px',
    border: '1px dashed rgba(255,255,255,.1)',
    color: 'rgba(236,230,240,.62)',
    cursor: 'pointer',
    background: 'none',
  },
  // tool palette
  palette: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '7px',
    marginTop: '8px',
  },
  tool: (active: boolean): React.CSSProperties => ({
    fontSize: '.72rem',
    padding: '9px',
    borderRadius: '10px',
    border: active ? '1px solid var(--color-cyan)' : '1px dashed rgba(255,255,255,.1)',
    textAlign: 'center' as const,
    color: active ? 'var(--color-cyan)' : 'rgba(236,230,240,.62)',
    background: active ? 'rgba(0,229,255,.08)' : 'rgba(255,255,255,.05)',
    cursor: 'pointer',
  }),
  toolSymbol: {
    display: 'block',
    fontSize: '1.1rem',
    color: 'var(--color-text)',
    marginBottom: '2px',
  },
  // tarifa editor
  tarifaBox: {
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '11px',
    padding: '10px',
    marginTop: '8px',
  },
  tarifaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    marginBottom: '6px',
  },
  tarifaLabel: {
    fontSize: '.72rem',
    width: '74px',
    color: 'rgba(236,230,240,.62)',
    flexShrink: 0,
  },
  tarifaInput: {
    flex: 1,
    padding: '6px 8px',
    fontSize: '.74rem',
    borderRadius: '7px',
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.1)',
    color: 'var(--color-text)',
    outline: 'none',
  },
  addLink: {
    fontSize: '.68rem',
    color: 'var(--color-cyan)',
    textDecoration: 'underline',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: '0',
    fontFamily: 'var(--font-body)',
  },
  // canvas area
  canvasArea: {
    flex: 1,
    padding: '16px 18px',
    position: 'relative' as const,
    overflowY: 'auto' as const,
  },
  canvasBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  snapLabel: {
    fontSize: '.7rem',
    color: 'rgba(236,230,240,.62)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  wysiwyg: {
    fontSize: '.66rem',
    color: 'var(--color-gold)',
  },
  canvas: {
    position: 'relative' as const,
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '12px',
    height: '480px',
    overflow: 'hidden' as const,
    background:
      'repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 28px), repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 28px), radial-gradient(circle at 50% 0%,rgba(255,20,147,.10),transparent 55%), #0b0020',
    cursor: 'crosshair',
  },
  stageBlock: (stageX: number, stageY: number, stageW: number, stageH: number, cw: number, ch: number): React.CSSProperties => ({
    position: 'absolute',
    left: `${(stageX / cw) * 100}%`,
    top: `${(stageY / ch) * 100}%`,
    width: `${(stageW / cw) * 100}%`,
    height: `${(stageH / ch) * 100}%`,
    background: 'linear-gradient(180deg,rgba(255,20,147,.35),rgba(255,20,147,.08))',
    border: '1.5px solid var(--color-pink)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-display)',
    letterSpacing: '.35em',
    fontSize: '.8rem',
    color: 'rgba(236,230,240,.9)',
    boxShadow: '0 0 22px rgba(255,20,147,.3)',
    zIndex: 5,
    pointerEvents: 'none',
  }),
  legend: {
    marginTop: '10px',
    display: 'flex',
    gap: '16px',
    fontSize: '.64rem',
    color: 'rgba(236,230,240,.62)',
    flexWrap: 'wrap' as const,
  },
  legendDot: (color: string): React.CSSProperties => ({
    display: 'inline-block',
    width: '11px',
    height: '11px',
    borderRadius: '50%',
    border: `1px solid ${color}`,
    verticalAlign: 'middle',
    marginRight: '5px',
  }),
  // table-props popover
  propsBox: (visible: boolean): React.CSSProperties => ({
    position: 'absolute',
    width: '210px',
    background: 'rgba(12,4,20,.97)',
    border: '1px solid var(--color-pink)',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 14px 40px rgba(0,0,0,.6)',
    zIndex: 20,
    fontSize: '.74rem',
    display: visible ? 'block' : 'none',
    top: '10px',
    right: '10px',
  }),
  propsTitle: {
    fontFamily: 'var(--font-display)',
    letterSpacing: '.04em',
    fontSize: '1rem',
    marginBottom: '8px',
    color: 'var(--color-text)',
  },
  propsLabel: {
    fontSize: '.6rem',
    letterSpacing: '.1em',
    textTransform: 'uppercase' as const,
    color: 'rgba(236,230,240,.45)',
    display: 'block',
    marginBottom: '3px',
    marginTop: '7px',
  },
  seg: {
    display: 'flex',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  segItem: (on: boolean): React.CSSProperties => ({
    flex: 1,
    textAlign: 'center' as const,
    padding: '5px',
    fontSize: '.7rem',
    background: on ? 'var(--color-pink)' : 'none',
    color: on ? '#fff' : 'rgba(236,230,240,.62)',
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'var(--font-body)',
  }),
  stepper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: '8px',
    padding: '4px 8px',
  },
  stepperBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0 4px',
  },
  xyGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
  },
  xyInput: {
    padding: '5px 7px',
    fontSize: '.72rem',
    borderRadius: '7px',
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.1)',
    color: 'var(--color-text)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  propsActs: {
    display: 'flex',
    gap: '6px',
    marginTop: '8px',
  },
  propsActBtn: (danger?: boolean): React.CSSProperties => ({
    flex: 1,
    textAlign: 'center' as const,
    fontSize: '.66rem',
    padding: '6px',
    borderRadius: '7px',
    border: danger ? '1px solid rgba(255,90,110,.5)' : '1px solid rgba(255,255,255,.1)',
    color: danger ? '#ff5a6e' : 'rgba(236,230,240,.62)',
    cursor: 'pointer',
    background: 'none',
    fontFamily: 'var(--font-body)',
  }),
  // error
  errorBox: {
    background: 'rgba(255,90,110,.08)',
    border: '1px solid rgba(255,90,110,.3)',
    borderRadius: '10px',
    padding: '12px 16px',
    color: '#ff5a6e',
    fontSize: '.88rem',
    margin: '12px 22px',
  },
  // success page
  successWrap: {
    minHeight: '100vh',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-body)',
    padding: '60px 28px',
    maxWidth: '640px',
    margin: '0 auto',
  },
  successTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '2.5rem',
    letterSpacing: '.04em',
    textShadow: '0 0 22px var(--color-pink)',
    color: 'var(--color-text)',
    marginBottom: '16px',
  },
};

// ── Main component ────────────────────────────────────────────────────────────

type ActiveTool = 'round-table' | 'rect-table' | 'rows' | 'general' | null;

function NewEvent() {
  // Event fields
  const [eventName, setEventName] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [description, setDescription] = useState('');
  const [mapUrl, setMapUrl] = useState('');

  // Canvas size
  const [canvasW, setCanvasW] = useState(1000);
  const [canvasH, setCanvasH] = useState(700);

  // Stage geometry (absolute units in canvas coord-space)
  const [stageX, setStageX] = useState(240);
  const [stageY, setStageY] = useState(20);
  const [stageW, setStageW] = useState(520);
  const [stageH, setStageH] = useState(100);

  // Sections
  const [sections, setSections] = useState<SectionDef[]>([
    {
      id: 'sec-0',
      name: 'VIP',
      layout_type: 'tables',
      capacity: 100,
      tarifas: [
        { quantity: 1, price: '120' },
        { quantity: 2, price: '220' },
      ],
      tables: [],
    },
  ]);
  const [activeSection, setActiveSection] = useState(0);

  // Canvas tool
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Selected table (for properties popover)
  const [selectedTableKey, setSelectedTableKey] = useState<string | null>(null); // "secIdx-tableIdx"

  // Submit
  const [publishing, setPublishing] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const sec = sections[activeSection];

  // ── Helpers ──────────────────────────────────────────────────────────────

  function patchSection(i: number, patch: Partial<SectionDef>) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));
  }

  function patchTarifa(secIdx: number, tIdx: number, patch: Partial<TarifaRow>) {
    setSections((s) =>
      s.map((sec, si) =>
        si !== secIdx
          ? sec
          : { ...sec, tarifas: sec.tarifas.map((t, ti) => (ti === tIdx ? { ...t, ...patch } : t)) }
      )
    );
  }

  function addTarifa() {
    const nextQty = sec.tarifas.length + 1;
    patchSection(activeSection, {
      tarifas: [...sec.tarifas, { quantity: nextQty, price: '' }],
    });
  }

  function removeTarifa(tIdx: number) {
    patchSection(activeSection, {
      tarifas: sec.tarifas.filter((_, i) => i !== tIdx),
    });
  }

  function addSection() {
    const idx = sections.length;
    setSections((s) => [
      ...s,
      {
        id: `sec-${idx}`,
        name: `Sección ${idx + 1}`,
        layout_type: 'tables',
        capacity: 100,
        tarifas: [
          { quantity: 1, price: '80' },
          { quantity: 2, price: '140' },
        ],
        tables: [],
      },
    ]);
    setActiveSection(idx);
  }

  // ── Canvas click → place table ────────────────────────────────────────────

  function handleCanvasClick(e: MouseEvent<HTMLDivElement>) {
    if (!activeTool) return;
    if (activeTool === 'general') return; // general admission has no tables

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    let rawX = ((e.clientX - rect.left) / rect.width) * 100;
    let rawY = ((e.clientY - rect.top) / rect.height) * 100;

    if (snapEnabled) {
      // Snap based on SNAP grid cells relative to % of canvas
      const cellXPct = (SNAP / rect.width) * 100;
      const cellYPct = (SNAP / rect.height) * 100;
      rawX = Math.round(rawX / cellXPct) * cellXPct;
      rawY = Math.round(rawY / cellYPct) * cellYPct;
    }

    const pos_x = Math.min(95, Math.max(5, rawX));
    const pos_y = Math.min(95, Math.max(5, rawY));

    const newTable: TableDef = {
      id: `tbl-${Date.now()}`,
      label: `Mesa ${sec.tables.length + 1}`,
      pos_x,
      pos_y,
      size: 64,
      shape: activeTool === 'rect-table' ? 'rect' : 'round',
      seat_count: 4,
      seating: 'around',
    };

    patchSection(activeSection, { tables: [...sec.tables, newTable] });
    setSelectedTableKey(`${activeSection}-${sec.tables.length}`);
  }

  // ── Table properties ──────────────────────────────────────────────────────

  const selectedParts = selectedTableKey?.split('-');
  const selectedSecIdx = selectedParts ? parseInt(selectedParts[0]) : -1;
  const selectedTblIdx = selectedParts ? parseInt(selectedParts[1]) : -1;
  const selectedTable =
    selectedSecIdx >= 0 && selectedTblIdx >= 0
      ? sections[selectedSecIdx]?.tables[selectedTblIdx]
      : null;

  function patchSelectedTable(patch: Partial<TableDef>) {
    if (selectedSecIdx < 0 || selectedTblIdx < 0) return;
    setSections((s) =>
      s.map((sec, si) =>
        si !== selectedSecIdx
          ? sec
          : {
              ...sec,
              tables: sec.tables.map((t, ti) => (ti !== selectedTblIdx ? t : { ...t, ...patch })),
            }
      )
    );
  }

  function deleteSelectedTable() {
    if (selectedSecIdx < 0 || selectedTblIdx < 0) return;
    setSections((s) =>
      s.map((sec, si) =>
        si !== selectedSecIdx
          ? sec
          : { ...sec, tables: sec.tables.filter((_, ti) => ti !== selectedTblIdx) }
      )
    );
    setSelectedTableKey(null);
  }

  function duplicateSelectedTable() {
    if (selectedSecIdx < 0 || selectedTblIdx < 0 || !selectedTable) return;
    const copy: TableDef = {
      ...selectedTable,
      id: `tbl-${Date.now()}`,
      label: `${selectedTable.label} (copia)`,
      pos_x: Math.min(90, selectedTable.pos_x + 5),
      pos_y: Math.min(90, selectedTable.pos_y + 5),
    };
    const secToUpdate = sections[selectedSecIdx];
    patchSection(selectedSecIdx, { tables: [...secToUpdate.tables, copy] });
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  const totalTables = sections.reduce((s, sec) => s + sec.tables.length, 0);
  const hasInventory =
    totalTables > 0 || sections.some((s) => s.layout_type === 'general' && s.capacity > 0);

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!hasInventory) return;
    setPublishing(true);
    setError(null);
    try {
      const { event } = await adminApi.createEvent({
        name: eventName,
        starts_at: new Date(dateTime).toISOString(),
        venue_name: venueName,
        venue_address: venueAddress,
        venue_photo_url: '',
        map_url: mapUrl,
        description,
        canvas_width: canvasW,
        canvas_height: canvasH,
        stage_x: stageX,
        stage_y: stageY,
        stage_w: stageW,
        stage_h: stageH,
      });

      // One shared phase for the whole event
      const { data: phase } = await adminApi.createPhase(event.id, {
        name: 'Preventa',
        starts_at: new Date('2020-01-01T00:00:00Z').toISOString(),
        ends_at: new Date(dateTime).toISOString(),
      });

      for (const sec of sections) {
        const { data: section } = await adminApi.createSection(event.id, {
          name: sec.name,
          layout_type: sec.layout_type,
          capacity: sec.layout_type === 'general' ? sec.capacity : null,
        });

        // Create price bundles from tarifa rows
        for (const tarifa of sec.tarifas) {
          if (tarifa.price) {
            await adminApi.createBundle(section.id, {
              phase_id: phase.id,
              quantity: tarifa.quantity,
              price: tarifa.price,
            });
          }
        }

        // Place tables (seated sections only)
        if (sec.layout_type === 'tables') {
          for (const t of sec.tables) {
            await adminApi.createTable(section.id, {
              label: t.label,
              seat_count: t.seat_count,
              pos_x: t.pos_x,
              pos_y: t.pos_y,
              size: t.size,
              shape: t.shape,
              seating: t.seating,
            });
          }
        }
      }

      await adminApi.publishEvent(event.id);
      setPublishedSlug(event.slug);
    } catch {
      setError('No se pudo crear el evento. Intenta de nuevo.');
    } finally {
      setPublishing(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (publishedSlug) {
    return (
      <div style={S.successWrap}>
        <h1 style={S.successTitle}>Evento publicado</h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
          Ya está en la home y listo para vender.
        </p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <li>
            <Link
              href={`/evento?slug=${publishedSlug}`}
              data-testid="public-link"
              style={{ color: 'var(--color-cyan)', textDecoration: 'underline' }}
            >
              Página pública de venta →
            </Link>
          </li>
          <li>
            <Link
              href={`/band/tickets/evento?slug=${publishedSlug}`}
              style={{ color: 'var(--color-cyan)', textDecoration: 'underline' }}
            >
              Administrar entradas →
            </Link>
          </li>
        </ul>
      </div>
    );
  }

  // ── Builder UI ────────────────────────────────────────────────────────────

  return (
    <form onSubmit={publish} style={S.wrap}>
      {/* ── Top bar ── */}
      <div style={S.topBar}>
        <span data-testid="builder-title" style={S.topTitle}>
          NUEVO EVENTO
        </span>
        <button
          type="submit"
          data-testid="btn-publish"
          disabled={publishing || !hasInventory}
          style={{
            ...S.publishBtn,
            opacity: publishing || !hasInventory ? 0.4 : 1,
            cursor: publishing || !hasInventory ? 'not-allowed' : 'pointer',
          }}
        >
          {publishing ? 'PUBLICANDO...' : 'CREAR Y PUBLICAR'}
        </button>
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      {/* ── Body: left panel + canvas ── */}
      <div style={S.stageWrap}>
        {/* ── LEFT PANEL ── */}
        <aside data-testid="left-panel" style={S.panel}>
          {/* Detalles */}
          <div style={S.eyebrow}>Detalles del evento</div>

          <div>
            <label style={{ ...S.propsLabel, marginTop: 0 }}>Nombre del evento</label>
            <input
              data-testid="input-event-name"
              style={S.fieldInput}
              placeholder="Nombre del evento"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              required
            />
          </div>

          <div style={S.row2}>
            <div>
              <label style={S.propsLabel}>Fecha y hora</label>
              <input
                data-testid="input-date"
                type="datetime-local"
                style={S.fieldInput}
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                required
              />
            </div>
            <div>
              {/* placeholder to keep row2 grid balanced */}
            </div>
          </div>

          <div>
            <label style={S.propsLabel}>Lugar</label>
            <input
              data-testid="input-venue-name"
              style={S.fieldInput}
              placeholder="Nombre del venue"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
            />
          </div>

          <div>
            <label style={S.propsLabel}>Dirección</label>
            <input
              data-testid="input-venue-address"
              style={S.fieldInput}
              placeholder="Dirección"
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
            />
          </div>

          <div>
            <label style={S.propsLabel}>Descripción</label>
            <textarea
              data-testid="input-description"
              style={{ ...S.fieldInput, resize: 'vertical', minHeight: '60px' }}
              placeholder="Descripción del evento"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label style={S.propsLabel}>URL del mapa</label>
            <input
              data-testid="input-map-url"
              style={S.fieldInput}
              placeholder="https://maps.google.com/..."
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
            />
          </div>

          {/* Canvas size */}
          <div style={S.eyebrow}>Tamaño del plano</div>
          <div style={S.row2}>
            <div>
              <label style={S.propsLabel}>Ancho</label>
              <input
                data-testid="input-canvas-w"
                type="number"
                min={400}
                style={S.fieldInput}
                value={canvasW}
                onChange={(e) => setCanvasW(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={S.propsLabel}>Alto</label>
              <input
                data-testid="input-canvas-h"
                type="number"
                min={300}
                style={S.fieldInput}
                value={canvasH}
                onChange={(e) => setCanvasH(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Stage geometry */}
          <div style={S.eyebrow}>Posición del escenario</div>
          <div style={S.row2}>
            <div>
              <label style={S.propsLabel}>X</label>
              <input
                data-testid="input-stage-x"
                type="number"
                style={S.fieldInput}
                value={stageX}
                onChange={(e) => setStageX(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={S.propsLabel}>Y</label>
              <input
                data-testid="input-stage-y"
                type="number"
                style={S.fieldInput}
                value={stageY}
                onChange={(e) => setStageY(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={S.propsLabel}>Ancho</label>
              <input
                data-testid="input-stage-w"
                type="number"
                style={S.fieldInput}
                value={stageW}
                onChange={(e) => setStageW(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={S.propsLabel}>Alto</label>
              <input
                data-testid="input-stage-h"
                type="number"
                style={S.fieldInput}
                value={stageH}
                onChange={(e) => setStageH(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Sections */}
          <div style={S.eyebrow}>Secciones</div>
          <div style={S.tabs}>
            {sections.map((s, i) => (
              <button
                key={s.id}
                type="button"
                data-testid="section-tab"
                onClick={() => setActiveSection(i)}
                style={i === activeSection ? S.tabActive : S.tabInactive}
              >
                {s.name}
              </button>
            ))}
            <button
              type="button"
              data-testid="btn-add-section"
              onClick={addSection}
              style={S.tabAdd}
            >
              + Agregar
            </button>
          </div>

          {/* Active section name + type */}
          <div>
            <label style={S.propsLabel}>Nombre de la sección</label>
            <input
              data-testid="input-section-name"
              style={S.fieldInput}
              value={sec.name}
              onChange={(e) => patchSection(activeSection, { name: e.target.value })}
            />
          </div>
          <div>
            <label style={S.propsLabel}>Tipo</label>
            <select
              style={S.fieldInput}
              value={sec.layout_type}
              onChange={(e) =>
                patchSection(activeSection, { layout_type: e.target.value as 'tables' | 'general' })
              }
            >
              <option value="tables">Con asientos</option>
              <option value="general">Entrada general (aforo)</option>
            </select>
          </div>
          {sec.layout_type === 'general' && (
            <div>
              <label style={S.propsLabel}>Aforo</label>
              <input
                type="number"
                min={1}
                style={S.fieldInput}
                value={sec.capacity}
                onChange={(e) => patchSection(activeSection, { capacity: Number(e.target.value) })}
              />
            </div>
          )}

          {/* Palette */}
          {sec.layout_type === 'tables' && (
            <>
              <div style={S.eyebrow}>Agregar al plano</div>
              <div style={S.palette}>
                <button
                  type="button"
                  data-testid="tool-round-table"
                  onClick={() => setActiveTool(activeTool === 'round-table' ? null : 'round-table')}
                  style={S.tool(activeTool === 'round-table')}
                >
                  <b style={S.toolSymbol}>⭘</b>Mesa redonda
                </button>
                <button
                  type="button"
                  data-testid="tool-rect-table"
                  onClick={() => setActiveTool(activeTool === 'rect-table' ? null : 'rect-table')}
                  style={S.tool(activeTool === 'rect-table')}
                >
                  <b style={S.toolSymbol}>▭</b>Mesa rectangular
                </button>
                <button
                  type="button"
                  data-testid="tool-rows"
                  onClick={() => setActiveTool(activeTool === 'rows' ? null : 'rows')}
                  style={S.tool(activeTool === 'rows')}
                >
                  <b style={S.toolSymbol}>☰</b>Fila de asientos
                </button>
                <button
                  type="button"
                  data-testid="tool-general"
                  onClick={() => setActiveTool(activeTool === 'general' ? null : 'general')}
                  style={S.tool(activeTool === 'general')}
                >
                  <b style={S.toolSymbol}>▢</b>Zona general
                </button>
              </div>
            </>
          )}

          {/* Tarifas */}
          <div style={S.eyebrow}>Tarifas (cantidad → precio)</div>
          <div style={S.tarifaBox}>
            {sec.tarifas.map((t, ti) => (
              <div key={ti} data-testid="tarifa-row" style={S.tarifaRow}>
                <span
                  style={{
                    ...S.tarifaLabel,
                    color: ti === 1 ? 'var(--color-gold)' : 'rgba(236,230,240,.62)',
                  }}
                >
                  {t.quantity === 1
                    ? '1 entrada'
                    : t.quantity === 2
                      ? '2 (combo)'
                      : `${t.quantity} (combo)`}
                </span>
                <input
                  data-testid="tarifa-price"
                  style={S.tarifaInput}
                  placeholder="S/ 0"
                  value={t.price}
                  onChange={(e) => patchTarifa(activeSection, ti, { price: e.target.value })}
                />
                {ti >= 2 && (
                  <button
                    type="button"
                    data-testid="btn-remove-tarifa"
                    onClick={() => removeTarifa(ti)}
                    style={{ background: 'none', border: 'none', color: '#ff5a6e', cursor: 'pointer', fontSize: '.85rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              data-testid="btn-add-tarifa"
              onClick={addTarifa}
              style={S.addLink}
            >
              + Agregar tarifa por cantidad
            </button>
          </div>
        </aside>

        {/* ── CANVAS AREA ── */}
        <section data-testid="canvas-area" style={S.canvasArea}>
          <div style={S.canvasBar}>
            <label style={S.snapLabel}>
              <input
                type="checkbox"
                data-testid="snap-grid-toggle"
                checked={snapEnabled}
                onChange={(e) => setSnapEnabled(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Ajustar a la cuadrícula
            </label>
            <span data-testid="wysiwyg-label" style={S.wysiwyg}>
              ★ Lo que ves es lo que compran
            </span>
          </div>

          {/* Stage readout */}
          <div
            data-testid="stage-readout"
            style={{ fontSize: '.62rem', color: 'var(--color-pink)', marginBottom: '6px' }}
          >
            Escenario · x {stageX} · y {stageY} · {stageW}×{stageH}
          </div>

          {/* Canvas */}
          <div
            ref={canvasRef}
            style={{
              ...S.canvas,
              cursor: activeTool ? 'crosshair' : 'default',
            }}
            onClick={handleCanvasClick}
          >
            {/* Stage block */}
            <div
              data-testid="canvas-stage"
              style={S.stageBlock(stageX, stageY, stageW, stageH, canvasW, canvasH)}
            >
              ESCENARIO
            </div>

            {/* Tables for all sections */}
            {sections.flatMap((sec, si) =>
              sec.tables.map((tbl, ti) => {
                const color = SECTION_COLORS[si % SECTION_COLORS.length];
                const key = `${si}-${ti}`;
                const isSelected = selectedTableKey === key;
                const sizePct = (tbl.size / canvasW) * 100;
                const isVip = sec.name.toLowerCase().includes('vip');

                return (
                  <div
                    key={key}
                    data-testid="canvas-table"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTableKey(isSelected ? null : key);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${tbl.pos_x - sizePct / 2}%`,
                      top: `${tbl.pos_y - ((tbl.size / canvasH) * 100) / 2}%`,
                      width: `${sizePct}%`,
                      paddingBottom: `${(tbl.size / canvasH) * 100}%`,
                      cursor: 'pointer',
                      zIndex: 10,
                    }}
                  >
                    {/* Table circle */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: '15%',
                        borderRadius: tbl.shape === 'round' ? '50%' : '10px',
                        background: isVip
                          ? 'radial-gradient(circle at 50% 35%,#3a1030,#1e0a1a)'
                          : 'radial-gradient(circle at 50% 35%,#2a1430,#160a1e)',
                        border: `1px solid ${isVip ? 'rgba(255,20,147,.5)' : 'rgba(0,229,255,.5)'}`,
                        outline: isSelected ? '2px solid var(--color-pink)' : undefined,
                        outlineOffset: isSelected ? '3px' : undefined,
                        boxShadow: isSelected ? '0 0 16px rgba(255,20,147,.5)' : undefined,
                      }}
                    />
                    {/* Label */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%,-50%)',
                        fontSize: '.55rem',
                        color: isVip ? '#ff8fce' : 'rgba(236,230,240,.7)',
                        pointerEvents: 'none',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tbl.label}·{tbl.seat_count}
                    </div>
                  </div>
                );
              })
            )}

            {/* Properties popover for selected table */}
            {selectedTable && (
              <div data-testid="table-props" style={S.propsBox(true)}>
                <p style={S.propsTitle}>{selectedTable.label}</p>

                <label style={S.propsLabel}>Forma</label>
                <div style={S.seg}>
                  <button
                    type="button"
                    style={S.segItem(selectedTable.shape === 'round')}
                    onClick={() => patchSelectedTable({ shape: 'round' })}
                  >
                    Redonda
                  </button>
                  <button
                    type="button"
                    style={S.segItem(selectedTable.shape === 'rect')}
                    onClick={() => patchSelectedTable({ shape: 'rect' })}
                  >
                    Rectangular
                  </button>
                </div>

                <label style={S.propsLabel}>Asientos</label>
                <div data-testid="seat-count" style={S.stepper}>
                  <button
                    type="button"
                    style={S.stepperBtn}
                    onClick={() =>
                      patchSelectedTable({ seat_count: Math.max(1, selectedTable.seat_count - 1) })
                    }
                  >
                    −
                  </button>
                  <b>{selectedTable.seat_count}</b>
                  <button
                    type="button"
                    style={S.stepperBtn}
                    onClick={() => patchSelectedTable({ seat_count: selectedTable.seat_count + 1 })}
                  >
                    +
                  </button>
                </div>

                <label style={S.propsLabel}>Tamaño (⌀ px)</label>
                <input
                  style={S.xyInput}
                  type="number"
                  min={24}
                  value={selectedTable.size}
                  onChange={(e) => patchSelectedTable({ size: Number(e.target.value) })}
                />

                <label style={S.propsLabel}>Posición</label>
                <div style={S.xyGrid}>
                  <input
                    style={S.xyInput}
                    type="number"
                    placeholder="x%"
                    value={Math.round(selectedTable.pos_x)}
                    onChange={(e) => patchSelectedTable({ pos_x: Number(e.target.value) })}
                  />
                  <input
                    style={S.xyInput}
                    type="number"
                    placeholder="y%"
                    value={Math.round(selectedTable.pos_y)}
                    onChange={(e) => patchSelectedTable({ pos_y: Number(e.target.value) })}
                  />
                </div>

                <div style={S.propsActs}>
                  <button type="button" style={S.propsActBtn()} onClick={duplicateSelectedTable}>
                    Duplicar
                  </button>
                  <button type="button" style={S.propsActBtn(true)} onClick={deleteSelectedTable}>
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table count */}
          <div
            data-testid="table-count"
            style={{ fontSize: '.66rem', color: 'rgba(236,230,240,.45)', marginTop: '8px' }}
          >
            {totalTables} {totalTables === 1 ? 'mesa' : 'mesas'} en el plano
          </div>

          {/* Legend */}
          <div style={S.legend}>
            {sections.map((s, si) => (
              <span key={s.id}>
                <span style={S.legendDot(SECTION_COLORS[si % SECTION_COLORS.length])} />
                {s.name}
                {s.tarifas[0]?.price ? ` · S/ ${s.tarifas[0].price}` : ''}
              </span>
            ))}
            {activeTool && (
              <span style={{ color: 'rgba(236,230,240,.45)' }}>
                Haz clic en el plano para colocar
              </span>
            )}
          </div>
        </section>
      </div>
    </form>
  );
}

export default function NewEventPage() {
  return (
    <AdminGate>
      <NewEvent />
    </AdminGate>
  );
}
