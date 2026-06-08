// Shared Tailwind v4 class strings for the ticketing UI (no tailwind.config;
// neon palette via arbitrary values). Keeps the components DRY and on-brand.

export const ui = {
  page:
    'min-h-screen text-white px-4 py-8 max-w-4xl mx-auto font-[Outfit] ' +
    'bg-[linear-gradient(180deg,#050010,#0d0025_45%,#100020_75%,#050010)]',
  h1: 'text-4xl tracking-wide font-[Bebas_Neue] [text-shadow:0_0_8px_#fff,0_0_22px_#ff1493] mb-1',
  h2: 'text-2xl text-[#ffd700] tracking-wide font-[Bebas_Neue] mt-6 mb-2',
  h3: 'text-[#00e5ff] text-lg mt-4 mb-2',
  muted: 'text-white/60 mb-4',
  card: 'bg-white/[0.04] border border-white/15 rounded-2xl p-5 mt-4 backdrop-blur',
  label: 'block text-white/70 text-sm mt-3 mb-1.5',
  input:
    'w-full max-w-md px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white ' +
    'outline-none focus:border-[#00e5ff]',
  btn:
    'mt-3 px-6 py-3 rounded-full text-white cursor-pointer transition font-[Bebas_Neue] tracking-wide text-lg ' +
    'bg-gradient-to-br from-[#ff1493] to-[#bf00ff] ' +
    'hover:-translate-y-0.5 hover:shadow-[0_0_22px_rgba(255,20,147,0.5)] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none',
  btnGhost:
    'mt-3 px-5 py-2.5 rounded-full cursor-pointer transition border border-white/20 text-white/90 hover:border-white/50',
  error: 'bg-[#ff325a]/15 border border-[#ff325a]/50 text-[#ff8aa8] px-4 py-3 rounded-xl my-4',
  seat:
    'w-11 h-11 rounded-lg border font-semibold cursor-pointer transition border-[#00e5ff] bg-[#00e5ff]/10 ' +
    'hover:-translate-y-0.5 hover:shadow-[0_0_14px_rgba(0,229,255,0.5)] ' +
    'data-[selected=true]:bg-[#ff1493] data-[selected=true]:border-[#ff1493] data-[selected=true]:shadow-[0_0_16px_rgba(255,20,147,0.7)] ' +
    'disabled:border-[#444] disabled:bg-white/5 disabled:text-[#555] disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none',
};
