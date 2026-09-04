/**
 * CSS escopado da landing AlthosHome (parte 1/3 — base/tokens até .solutions).
 * Split out of althos-home.css.ts — ver esse arquivo pro contexto completo
 * e HOME_CSS (concatenação das 3 partes).
 */
export const HOME_CSS_1 = `
.althos-home {
  --bg: #1a1a1a;
  --surface: #262626;
  --surface-2: #333333;
  --ink: #f4f4f4;
  --ink-dim: #a8a8a8;
  --ink-faint: #6f6f6f;
  --line: rgba(244,244,244,0.09);
  --line-strong: rgba(244,244,244,0.16);
  --accent: #4589ff;
  --accent-bright: #78a9ff;
  --accent-deep: #0f62fe;
  --accent-glow: rgba(69,137,255,0.20);
  --shadow-sm: none;
  --shadow-card: none;
  --shadow-float: none;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --sans: var(--font-plex), "IBM Plex Sans", system-ui, sans-serif;
  position: relative;
  font-family: var(--sans);
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: clip;
}
.althos-home *, .althos-home *::before, .althos-home *::after { box-sizing: border-box; }
.althos-home h1, .althos-home h2, .althos-home h3, .althos-home h4, .althos-home p, .althos-home ul { margin: 0; }
.althos-home a { color: inherit; }
.althos-home ul { padding: 0; list-style: none; }

/* aurora / mesh background — pastel discreto sobre branco (sem mix-blend) */
.althos-home .aurora { position: fixed; inset: -25%; z-index: 0; pointer-events: none; filter: blur(82px) saturate(1.02); opacity: 0.42; }
.althos-home .aurora span { position: absolute; border-radius: 50%; will-change: transform; }
.althos-home .aurora .a1 { width: 55vw; height: 55vw; left: 8%; top: -14%; background: radial-gradient(circle at 50% 50%, rgba(69,137,255,0.20), transparent 62%); animation: ah-drift1 26s var(--ease) infinite alternate; }
.althos-home .aurora .a2 { width: 48vw; height: 48vw; right: -6%; top: 6%; background: radial-gradient(circle at 50% 50%, rgba(120,169,255,0.16), transparent 62%); animation: ah-drift2 32s var(--ease) infinite alternate; }
.althos-home .aurora .a3 { width: 42vw; height: 42vw; left: 34%; top: 24%; background: radial-gradient(circle at 50% 50%, rgba(166,200,255,0.16), transparent 64%); animation: ah-drift3 38s var(--ease) infinite alternate; }
@keyframes ah-drift1 { 0% { transform: translate3d(0,0,0) scale(1); } 100% { transform: translate3d(6%,5%,0) scale(1.12); } }
@keyframes ah-drift2 { 0% { transform: translate3d(0,0,0) scale(1.05); } 100% { transform: translate3d(-5%,7%,0) scale(0.95); } }
@keyframes ah-drift3 { 0% { transform: translate3d(0,0,0) scale(0.95); } 100% { transform: translate3d(4%,-6%,0) scale(1.1); } }

.althos-home .bg-fade { position: fixed; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(180deg, rgba(26,26,26,0.7) 0%, transparent 24%, transparent 70%, var(--bg) 100%); }
.althos-home .grain { position: fixed; inset: 0; z-index: 2; pointer-events: none; opacity: 0.025; mix-blend-mode: multiply; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); animation: ah-grain 6s steps(4) infinite; }
@keyframes ah-grain { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-4%,3%); } 50% { transform: translate(3%,-2%); } 75% { transform: translate(-2%,-4%); } }

.althos-home .shell { position: relative; z-index: 5; }

/* Hero */
.althos-home .hero { max-width: 1120px; margin: 0 auto; padding: 56px 40px 96px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 60px; }
.althos-home .hero-copy { display: flex; flex-direction: column; align-items: center; width: 100%; }
.althos-home .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px 7px 12px; border-radius: 999px; border: 1px solid var(--line-strong); background: linear-gradient(180deg, rgba(69,137,255,0.08), rgba(69,137,255,0.02)); font-size: 13px; font-weight: 600; letter-spacing: 0.01em; color: var(--accent-bright); width: fit-content; box-shadow: var(--shadow-sm); }
.althos-home .eyebrow .star { color: var(--accent); font-size: 12px; line-height: 1; }
.althos-home h1.headline { font-weight: 800; font-size: clamp(46px,5.6vw,80px); line-height: 1.04; letter-spacing: -0.025em; margin-top: 26px; text-wrap: balance; color: var(--ink); max-width: 24ch; }
.althos-home h1.headline em { font-style: italic; background: linear-gradient(100deg, var(--accent-bright), var(--accent-deep)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.althos-home .subtitle { margin-top: 26px; font-size: clamp(17px,1.3vw,20px); line-height: 1.6; color: var(--ink-dim); max-width: 32em; font-weight: 400; }
.althos-home .cta-row { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-top: 36px; }
.althos-home .btn { font-size: 15.5px; font-weight: 600; letter-spacing: -0.005em; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; padding: 14px 24px; border-radius: 0; transition: transform 0.25s var(--ease), box-shadow 0.3s var(--ease), background 0.25s var(--ease), border-color 0.25s var(--ease); }
.althos-home .btn-solid { color: #fff; border: 1px solid var(--accent); background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 8px 24px -8px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.18); }
.althos-home .btn-solid:hover { transform: translateY(-2px); box-shadow: 0 16px 36px -10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.24); }
.althos-home .btn-solid .arrow { transition: transform 0.25s var(--ease); }
.althos-home .btn-solid:hover .arrow { transform: translateX(3px); }
.althos-home .btn-outline { color: var(--ink); border: 1px solid var(--line-strong); background: var(--surface); box-shadow: var(--shadow-sm); }
.althos-home .btn-outline:hover { border-color: var(--ink-faint); background: var(--surface-2); transform: translateY(-2px); }
.althos-home .microcopy { margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13.5px; color: var(--ink-faint); font-weight: 500; }
.althos-home .microcopy .check { color: var(--accent); }
.althos-home .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 40px; }
.althos-home .chip { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); font-size: 14.5px; font-weight: 500; color: var(--ink-dim); box-shadow: var(--shadow-sm); transition: border-color 0.25s var(--ease), color 0.25s var(--ease), background 0.25s var(--ease); }
.althos-home .chip:hover { border-color: var(--line-strong); color: var(--ink); background: var(--surface-2); }
.althos-home .chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }

/* Product mockup */
.althos-home .mock-wrap { position: relative; perspective: 1600px; display: flex; justify-content: center; width: 100%; max-width: 1000px; margin: 0 auto; }
.althos-home .mock-glow { position: absolute; inset: -8% -4% -16% -4%; background: radial-gradient(60% 55% at 60% 38%, var(--accent-glow), transparent 70%); filter: blur(50px); z-index: 0; pointer-events: none; }
.althos-home .browser { position: relative; z-index: 1; width: 100%; border-radius: 0; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-float); overflow: hidden; transform-style: preserve-3d; will-change: transform; transition: transform 0.18s var(--ease); }
.althos-home .browser-bar { display: flex; align-items: center; gap: 14px; padding: 13px 16px; border-bottom: 1px solid var(--line); background: var(--surface-2); }
.althos-home .dots { display: flex; gap: 7px; }
.althos-home .dots i { width: 11px; height: 11px; border-radius: 50%; background: #525252; display: block; }
.althos-home .url { flex: 1; max-width: 320px; margin: 0 auto; background: rgba(244,244,244,0.06); border: 1px solid var(--line); border-radius: 0; padding: 6px 12px; font-size: 12px; color: var(--ink-faint); display: flex; align-items: center; gap: 7px; }
.althos-home .url .lock { width: 9px; height: 9px; opacity: 0.6; }
.althos-home .tabs { display: flex; align-items: stretch; gap: 2px; padding: 0 10px; border-bottom: 1px solid var(--line); background: var(--surface-2); overflow-x: auto; scrollbar-width: none; }
.althos-home .tabs::-webkit-scrollbar { display: none; }
.althos-home .tab { position: relative; flex: 0 0 auto; font-size: 13px; font-weight: 600; letter-spacing: -0.005em; color: var(--ink-faint); background: none; border: none; cursor: pointer; padding: 13px 15px 14px; white-space: nowrap; transition: color 0.22s var(--ease); }
.althos-home .tab:hover { color: var(--ink-dim); }
.althos-home .tab[aria-selected="true"] { color: var(--ink); }
.althos-home .tab::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px; border-radius: 0; background: linear-gradient(90deg, var(--accent-bright), var(--accent)); transform: scaleX(0); transform-origin: center; transition: transform 0.3s var(--ease); }
.althos-home .tab[aria-selected="true"]::after { transform: scaleX(1); }
.althos-home .browser-screen { position: relative; display: block; line-height: 0; background: #202020; aspect-ratio: 1820 / 862; }
.althos-home .panel { position: absolute; inset: 0; opacity: 0; visibility: hidden; transition: opacity 0.28s var(--ease); }
.althos-home .panel.active { opacity: 1; visibility: visible; }
.althos-home .panel img { width: 100%; height: 100%; display: block; object-fit: contain; object-position: center; cursor: zoom-in; }

@media (max-width: 940px) {
  .althos-home .hero { padding-top: 16px; gap: 44px; }
  .althos-home .mock-wrap { width: 100%; margin: 0 auto; }
}

/* Dores (nomeia o problema antes de mostrar a solução) */
.althos-home .pains { position: relative; max-width: 1180px; margin: 0 auto; padding: 40px 40px 20px; }
.althos-home .pains-head { max-width: 720px; margin: 0 auto 40px; text-align: center; }
.althos-home .pains-head .eyebrow { margin: 0 auto 22px; }
.althos-home .pains-head h2 { font-weight: 800; font-size: clamp(30px,3.8vw,50px); line-height: 1.05; letter-spacing: -0.02em; color: var(--ink); text-wrap: balance; }
.althos-home .pains-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
.althos-home .pain { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 0; padding: 24px 20px; background: var(--surface); transition: border-color 0.3s var(--ease), transform 0.3s var(--ease); }
.althos-home .pain:hover { border-color: var(--line-strong); transform: translateY(-3px); }
.althos-home .pain-icon { width: 38px; height: 38px; border-radius: 0; display: grid; place-items: center; border: 1px solid rgba(250,77,86,0.28); background: rgba(250,77,86,0.08); color: #fa4d56; margin-bottom: 14px; }
.althos-home .pain-icon svg { width: 19px; height: 19px; }
.althos-home .pain h4 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 7px; }
.althos-home .pain p { font-size: 13.5px; line-height: 1.5; color: var(--ink-dim); }
@media (max-width: 860px) { .althos-home .pains-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 640px) {
  .althos-home .pains { padding: 40px 16px 8px; }
  .althos-home .pains-head { margin-bottom: 24px; }
  .althos-home .pains-head h2 { font-size: clamp(24px, 7vw, 32px); }
  .althos-home .pains-grid { grid-template-columns: 1fr; gap: 10px; }
  .althos-home .pain { padding: 16px 14px; }
}

/* Stats */
.althos-home .stats { position: relative; background: var(--surface-2); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.althos-home .stats-inner { max-width: 1180px; margin: 0 auto; padding: 64px 40px; display: grid; grid-template-columns: repeat(3,1fr); align-items: center; }
.althos-home .stat { text-align: center; padding: 6px 28px; position: relative; }
.althos-home .stat + .stat::before { content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 1px; height: 64px; background: linear-gradient(180deg, transparent, var(--line-strong), transparent); }
.althos-home .stat-num { font-weight: 700; letter-spacing: -0.03em; font-size: clamp(48px,6vw,84px); line-height: 1; color: var(--accent); font-variant-numeric: tabular-nums; }
.althos-home .stat-num .unit { font-size: 0.62em; letter-spacing: -0.02em; margin-left: 1px; }
.althos-home .stat-label { margin-top: 14px; font-size: clamp(14px,1.1vw,16px); color: var(--ink-dim); font-weight: 500; letter-spacing: 0.005em; }
@media (max-width: 760px) {
  .althos-home .stats-inner { grid-template-columns: 1fr; gap: 44px; padding: 48px 40px; }
  .althos-home .stat + .stat::before { left: 50%; top: 0; transform: translateX(-50%); width: 80px; height: 1px; background: linear-gradient(90deg, transparent, var(--line-strong), transparent); }
}

/* Comparativo */
.althos-home .compare { position: relative; max-width: 1080px; margin: 0 auto; padding: 96px 40px 110px; border-top: 1px solid var(--line); }
.althos-home .compare-head { max-width: 760px; margin: 0 auto 48px; text-align: center; }
.althos-home .compare-head .eyebrow { margin: 0 auto 22px; }
.althos-home .compare-head h2 { font-weight: 800; font-size: clamp(32px,4.2vw,56px); line-height: 1.04; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.althos-home .compare-head p { margin-top: 20px; font-size: clamp(16px,1.2vw,18px); line-height: 1.6; color: var(--ink-dim); }
.althos-home .cmp-table { border: 1px solid var(--line); border-radius: 0; overflow: hidden; background: var(--surface); box-shadow: var(--shadow-card); }
.althos-home .cmp-row { display: grid; grid-template-columns: minmax(0,1.8fr) 1fr 1fr 1fr; align-items: center; border-top: 1px solid var(--line); }
.althos-home .cmp-row:first-child { border-top: none; }
.althos-home .cmp-header { background: var(--surface-2); }
.althos-home .cmp-header .cmp-feat, .althos-home .cmp-header .cmp-col { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); padding-top: 18px; padding-bottom: 18px; }
.althos-home .cmp-feat { padding: 16px 20px; font-size: 14.5px; font-weight: 500; color: var(--ink-dim); line-height: 1.35; }
.althos-home .cmp-col { padding: 16px 12px; text-align: center; display: flex; align-items: center; justify-content: center; min-height: 56px; }
.althos-home .cmp-col.cmp-althos { background: linear-gradient(180deg, rgba(15,98,254,0.07), rgba(15,98,254,0.02)); position: relative; }
.althos-home .cmp-header .cmp-col.cmp-althos { color: var(--accent-bright); font-weight: 800; }
.althos-home .cmp-yes { color: var(--accent); display: grid; place-items: center; }
.althos-home .cmp-yes svg { width: 22px; height: 22px; }
.althos-home .cmp-no { color: rgba(244,244,244,0.28); display: grid; place-items: center; }
.althos-home .cmp-no svg { width: 19px; height: 19px; }
.althos-home .cmp-partial { font-size: 12.5px; font-weight: 500; color: var(--ink-faint); line-height: 1.25; }
/* Garantias / objeções */
.althos-home .guarantees { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-top: 28px; }
.althos-home .guarantee { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 0; padding: 22px 20px; background: var(--surface); box-shadow: var(--shadow-sm); transition: border-color 0.3s var(--ease), transform 0.3s var(--ease), box-shadow 0.3s var(--ease); }
.althos-home .guarantee:hover { border-color: var(--line-strong); transform: translateY(-3px); box-shadow: var(--shadow-card); }
.althos-home .g-tick { width: 38px; height: 38px; border-radius: 0; display: grid; place-items: center; border: 1px solid rgba(15,98,254,0.18); background: rgba(15,98,254,0.08); color: var(--accent); margin-bottom: 14px; }
.althos-home .g-tick svg { width: 19px; height: 19px; }
.althos-home .guarantee h4 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 7px; }
.althos-home .guarantee p { font-size: 13.5px; line-height: 1.5; color: var(--ink-dim); }
@media (max-width: 860px) {
  .althos-home .guarantees { grid-template-columns: repeat(2,1fr); }
}

/* Ecosystem (intro curta, só headline) */
.althos-home .ecosystem { position: relative; max-width: 900px; margin: 0 auto; padding: 64px 40px 8px; text-align: center; }
.althos-home .ecosystem .eyebrow { margin: 0 auto 22px; }
.althos-home .ecosystem h2 { font-weight: 800; font-size: clamp(32px,4.4vw,56px); line-height: 1.06; letter-spacing: -0.02em; color: var(--ink); text-wrap: balance; }
.althos-home .ecosystem p { margin-top: 18px; font-size: clamp(16px,1.2vw,18px); line-height: 1.6; color: var(--ink-dim); max-width: 640px; margin-left: auto; margin-right: auto; }
@media (max-width: 640px) {
  .althos-home .ecosystem { padding: 44px 16px 4px; }
  .althos-home .ecosystem h2 { font-size: clamp(24px, 7vw, 32px); }
}

/* Solutions — abas horizontais + painel texto/imagem */
.althos-home .solutions { position: relative; max-width: 1280px; margin: 0 auto; padding: 40px 40px 110px; }
.althos-home .solutions-head { max-width: 760px; margin: 0 auto 40px; text-align: center; }
.althos-home .solutions-head .eyebrow { margin: 0 auto 22px; }
.althos-home .solutions-head h2 { font-weight: 800; font-size: clamp(32px,4.4vw,56px); line-height: 1.06; letter-spacing: -0.02em; color: var(--ink); text-wrap: balance; }
.althos-home .solutions-head p { margin-top: 18px; font-size: clamp(15px,1.1vw,17px); line-height: 1.6; color: var(--ink-dim); }
.althos-home .sol-tabbar { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid var(--line); }
.althos-home .sol-tab { position: relative; padding: 16px 22px; font-size: 15px; font-weight: 700; color: var(--ink-faint); background: none; border: none; cursor: pointer; transition: color 0.25s var(--ease); }
.althos-home .sol-tab:hover { color: var(--ink-dim); }
.althos-home .sol-tab.active { color: var(--ink); }
.althos-home .sol-tab::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--accent); transform: scaleX(0); transition: transform 0.3s var(--ease); }
.althos-home .sol-tab.active::after { transform: scaleX(1); }
.althos-home .sol-panel { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 56px; align-items: center; padding: 48px 0 0; }
.althos-home .sol-copy .kicker { display: inline-block; font-size: 12.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); margin-bottom: 14px; }
.althos-home .sol-copy h3 { font-weight: 800; font-size: clamp(26px,2.6vw,38px); line-height: 1.12; letter-spacing: -0.015em; color: var(--ink); text-wrap: balance; }
.althos-home .sol-copy p { margin-top: 16px; font-size: 16px; line-height: 1.6; color: var(--ink-dim); max-width: 34em; }
.althos-home .sol-bullets { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
.althos-home .sol-bullets li { display: flex; align-items: flex-start; gap: 9px; font-size: 14.5px; line-height: 1.4; color: var(--ink-dim); }
.althos-home .sol-bullets svg { width: 16px; height: 16px; flex: 0 0 auto; margin-top: 2px; color: var(--accent); }
.althos-home .sol-copy .btn { margin-top: 26px; }
.althos-home .sol-media { position: relative; }
.althos-home .sol-frame { position: relative; border-radius: 0; overflow: hidden; background: var(--surface); border: 1px solid var(--line); }
.althos-home .sol-frame-bar { display: flex; align-items: center; gap: 7px; padding: 12px 15px; border-bottom: 1px solid var(--line); background: var(--surface-2); }
.althos-home .sol-frame-bar i { width: 10px; height: 10px; border-radius: 50%; background: #525252; }
.althos-home .sol-shot { position: relative; background: #202020; aspect-ratio: 1820 / 862; }
.althos-home .sol-shot img { width: 100%; height: 100%; display: block; object-fit: contain; cursor: zoom-in; }
@media (max-width: 900px) {
  .althos-home .sol-panel { grid-template-columns: 1fr; gap: 28px; padding-top: 32px; }
  .althos-home .sol-tabbar { overflow-x: auto; scrollbar-width: none; flex-wrap: nowrap; }
  .althos-home .sol-tabbar::-webkit-scrollbar { display: none; }
  .althos-home .sol-tab { flex: 0 0 auto; padding: 12px 16px; font-size: 13.5px; }
}
@media (max-width: 640px) {
  .althos-home .solutions { padding: 32px 16px 56px; }
  .althos-home .solutions-head { margin-bottom: 24px; }
  .althos-home .solutions-head h2 { font-size: clamp(24px, 7vw, 32px); }
}
`
