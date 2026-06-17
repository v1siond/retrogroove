// Ticketing UI class strings — backed by design tokens (Tailwind v4 @theme in globals.css).
// Colors reference CSS vars via Tailwind's var() syntax; no hardcoded hex that duplicates a token.

export const ui = {
  page:
    'min-h-screen px-4 py-8 max-w-4xl mx-auto ' +
    'bg-[var(--color-bg)] text-[var(--color-text)] font-[var(--font-body)]',
  h1: 'text-4xl tracking-wide font-[Bebas_Neue] [text-shadow:0_0_8px_var(--color-text),0_0_22px_var(--color-pink)] mb-1',
  h2: 'text-2xl tracking-wide font-[Bebas_Neue] mt-6 mb-2 text-[var(--color-gold)]',
  h3: 'text-lg mt-4 mb-2 text-[var(--color-cyan)]',
  muted: 'mb-4 text-[var(--color-text-muted)]',
  card: 'bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5 mt-4 backdrop-blur',
  label: 'block text-sm mt-3 mb-1.5 text-[var(--color-text-muted)]',
  input:
    'w-full max-w-md px-3.5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] ' +
    'outline-none focus:border-[var(--color-cyan)]',
  btn:
    'mt-3 px-6 py-3 rounded-full text-white cursor-pointer transition font-[Bebas_Neue] tracking-wide text-lg ' +
    'bg-[var(--color-pink)] ' +
    'hover:-translate-y-0.5 hover:shadow-[var(--shadow-cta)] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none',
  btnGhost:
    'mt-3 px-5 py-2.5 rounded-full cursor-pointer transition border border-[var(--color-border)] text-[var(--color-text)]',
  error: 'bg-[var(--color-red)]/15 border border-[var(--color-red)]/50 text-[var(--color-red)] px-4 py-3 rounded-xl my-4',
  seat:
    'w-11 h-11 rounded-lg border font-semibold cursor-pointer transition border-[var(--color-cyan)] bg-[var(--color-cyan)]/10 ' +
    'hover:-translate-y-0.5 hover:shadow-[0_0_14px_rgba(0,229,255,0.5)] ' +
    'data-[selected=true]:bg-[var(--color-pink)] data-[selected=true]:border-[var(--color-pink)] data-[selected=true]:shadow-[var(--shadow-seat-selected)] ' +
    'disabled:border-[var(--color-border)] disabled:bg-white/5 disabled:text-[var(--color-text-faint)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none',
};
