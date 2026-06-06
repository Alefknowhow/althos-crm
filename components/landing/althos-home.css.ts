/**
 * CSS escopado da landing AlthosHome. TODAS as regras são prefixadas com
 * `.althos-home` (sem resets globais `*`/`body`) para não vazar para o
 * header/footer (SiteShell) nem para outras páginas. Acento mapeado do
 * roxo do protótipo para o AZUL atual do Althos.
 */
export const HOME_CSS = `
.althos-home {
  --bg: #0A0E1A;
  --surface: #121826;
  --surface-2: #1a2234;
  --ink: #F7F8FA;
  --ink-dim: #C3C6CE;
  --ink-faint: #9498A2;
  --line: rgba(255,255,255,0.08);
  --line-strong: rgba(255,255,255,0.14);
  --accent: #3b82f6;
  --accent-bright: #60a5fa;
  --accent-deep: #1d4ed8;
  --accent-glow: rgba(59,130,246,0.45);
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --sans: "Hanken Grotesk", -apple-system, system-ui, sans-serif;
  position: relative;
  font-family: var(--sans);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: clip;
}
.althos-home *, .althos-home *::before, .althos-home *::after { box-sizing: border-box; }
.althos-home h1, .althos-home h2, .althos-home h3, .althos-home h4, .althos-home p, .althos-home ul { margin: 0; }
.althos-home a { color: inherit; }
.althos-home ul { padding: 0; list-style: none; }

/* aurora / mesh background (fixo só enquanto a home está montada) */
.althos-home .aurora { position: fixed; inset: -25%; z-index: 0; pointer-events: none; filter: blur(60px) saturate(1.1); opacity: 0.85; }
.althos-home .aurora span { position: absolute; border-radius: 50%; mix-blend-mode: screen; will-change: transform; }
.althos-home .aurora .a1 { width: 55vw; height: 55vw; left: 8%; top: -10%; background: radial-gradient(circle at 50% 50%, rgba(37,99,235,0.55), transparent 62%); animation: ah-drift1 26s var(--ease) infinite alternate; }
.althos-home .aurora .a2 { width: 48vw; height: 48vw; right: -6%; top: 14%; background: radial-gradient(circle at 50% 50%, rgba(29,78,216,0.42), transparent 62%); animation: ah-drift2 32s var(--ease) infinite alternate; }
.althos-home .aurora .a3 { width: 42vw; height: 42vw; left: 30%; top: 38%; background: radial-gradient(circle at 50% 50%, rgba(96,165,250,0.34), transparent 64%); animation: ah-drift3 38s var(--ease) infinite alternate; }
@keyframes ah-drift1 { 0% { transform: translate3d(0,0,0) scale(1); } 100% { transform: translate3d(6%,5%,0) scale(1.12); } }
@keyframes ah-drift2 { 0% { transform: translate3d(0,0,0) scale(1.05); } 100% { transform: translate3d(-5%,7%,0) scale(0.95); } }
@keyframes ah-drift3 { 0% { transform: translate3d(0,0,0) scale(0.95); } 100% { transform: translate3d(4%,-6%,0) scale(1.1); } }

.althos-home .bg-fade { position: fixed; inset: 0; z-index: 1; pointer-events: none; background: radial-gradient(120% 80% at 50% -10%, transparent 40%, rgba(10,14,26,0.55) 100%), linear-gradient(180deg, rgba(10,14,26,0.4) 0%, transparent 18%, transparent 72%, var(--bg) 100%); }
.althos-home .grain { position: fixed; inset: 0; z-index: 2; pointer-events: none; opacity: 0.05; mix-blend-mode: overlay; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); animation: ah-grain 6s steps(4) infinite; }
@keyframes ah-grain { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-4%,3%); } 50% { transform: translate(3%,-2%); } 75% { transform: translate(-2%,-4%); } }

.althos-home .shell { position: relative; z-index: 5; }

/* Hero */
.althos-home .hero { max-width: 1360px; margin: 0 auto; padding: 40px 40px 110px; display: grid; grid-template-columns: minmax(0,0.78fr) minmax(0,1.5fr); align-items: center; gap: 40px; }
.althos-home .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px 7px 12px; border-radius: 999px; border: 1px solid var(--line-strong); background: linear-gradient(180deg, rgba(59,130,246,0.10), rgba(59,130,246,0.02)); font-size: 13px; font-weight: 600; letter-spacing: 0.01em; color: var(--ink); width: fit-content; box-shadow: 0 0 26px -8px var(--accent-glow); }
.althos-home .eyebrow .star { color: var(--accent-bright); font-size: 12px; line-height: 1; }
.althos-home h1.headline { font-weight: 800; font-size: clamp(46px,5.6vw,84px); line-height: 1.04; letter-spacing: -0.025em; margin-top: 26px; text-wrap: balance; color: var(--ink); }
.althos-home h1.headline em { font-style: italic; background: linear-gradient(100deg, var(--accent-bright), #93c5fd); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.althos-home .subtitle { margin-top: 26px; font-size: clamp(17px,1.3vw,20px); line-height: 1.6; color: var(--ink-dim); max-width: 30em; font-weight: 400; }
.althos-home .cta-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 36px; }
.althos-home .btn { font-size: 15.5px; font-weight: 600; letter-spacing: -0.005em; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; padding: 14px 24px; border-radius: 12px; transition: transform 0.25s var(--ease), box-shadow 0.3s var(--ease), background 0.25s var(--ease), border-color 0.25s var(--ease); }
.althos-home .btn-solid { color: #fff; border: 1px solid var(--accent-bright); background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 8px 30px -8px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.22); }
.althos-home .btn-solid:hover { transform: translateY(-2px); box-shadow: 0 14px 44px -10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.28); }
.althos-home .btn-solid .arrow { transition: transform 0.25s var(--ease); }
.althos-home .btn-solid:hover .arrow { transform: translateX(3px); }
.althos-home .btn-outline { color: var(--ink); border: 1px solid var(--line-strong); background: rgba(255,255,255,0.02); }
.althos-home .btn-outline:hover { border-color: var(--ink-dim); background: rgba(255,255,255,0.05); transform: translateY(-2px); }
.althos-home .microcopy { margin-top: 16px; display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--ink-faint); font-weight: 500; }
.althos-home .microcopy .check { color: var(--accent-bright); }
.althos-home .chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 40px; }
.althos-home .chip { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.022); font-size: 14.5px; font-weight: 500; color: var(--ink-dim); transition: border-color 0.25s var(--ease), color 0.25s var(--ease), background 0.25s var(--ease); }
.althos-home .chip:hover { border-color: var(--line-strong); color: var(--ink); background: rgba(255,255,255,0.04); }
.althos-home .chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-bright); box-shadow: 0 0 8px var(--accent-glow); }

/* Product mockup */
.althos-home .mock-wrap { position: relative; perspective: 1600px; display: flex; justify-content: center; width: calc(100% + 60px); margin-right: -60px; }
.althos-home .mock-glow { position: absolute; inset: -8% -4% -16% -4%; background: radial-gradient(60% 55% at 60% 38%, var(--accent-glow), transparent 70%); filter: blur(50px); z-index: 0; pointer-events: none; }
.althos-home .browser { position: relative; z-index: 1; width: 100%; border-radius: 16px; background: var(--surface); border: 1px solid var(--line-strong); box-shadow: 0 40px 90px -30px rgba(0,0,0,0.85), 0 2px 0 rgba(255,255,255,0.04) inset; overflow: hidden; transform-style: preserve-3d; will-change: transform; transition: transform 0.18s var(--ease); }
.althos-home .browser-bar { display: flex; align-items: center; gap: 14px; padding: 13px 16px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent); }
.althos-home .dots { display: flex; gap: 7px; }
.althos-home .dots i { width: 11px; height: 11px; border-radius: 50%; background: #2c3242; display: block; }
.althos-home .url { flex: 1; max-width: 320px; margin: 0 auto; background: rgba(0,0,0,0.4); border: 1px solid var(--line); border-radius: 7px; padding: 6px 12px; font-size: 12px; color: var(--ink-faint); display: flex; align-items: center; gap: 7px; }
.althos-home .url .lock { width: 9px; height: 9px; opacity: 0.6; }
.althos-home .tabs { display: flex; align-items: stretch; gap: 2px; padding: 0 10px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,0.018), transparent); overflow-x: auto; scrollbar-width: none; }
.althos-home .tabs::-webkit-scrollbar { display: none; }
.althos-home .tab { position: relative; flex: 0 0 auto; font-size: 13px; font-weight: 600; letter-spacing: -0.005em; color: var(--ink-faint); background: none; border: none; cursor: pointer; padding: 13px 15px 14px; white-space: nowrap; transition: color 0.22s var(--ease); }
.althos-home .tab:hover { color: var(--ink-dim); }
.althos-home .tab[aria-selected="true"] { color: var(--ink); }
.althos-home .tab::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, var(--accent-bright), var(--accent)); box-shadow: 0 0 12px var(--accent-glow); transform: scaleX(0); transform-origin: center; transition: transform 0.3s var(--ease); }
.althos-home .tab[aria-selected="true"]::after { transform: scaleX(1); }
.althos-home .browser-screen { position: relative; display: block; line-height: 0; background: #0d1018; aspect-ratio: 1820 / 862; }
.althos-home .panel { position: absolute; inset: 0; opacity: 0; visibility: hidden; transition: opacity 0.28s var(--ease); }
.althos-home .panel.active { opacity: 1; visibility: visible; }
.althos-home .panel img { width: 100%; height: 100%; display: block; object-fit: contain; object-position: center; cursor: zoom-in; }

@media (max-width: 940px) {
  .althos-home .hero { grid-template-columns: 1fr; padding-top: 16px; gap: 48px; text-align: left; }
  .althos-home .mock-wrap { order: 2; width: 100%; margin-right: 0; }
}

/* Stats */
.althos-home .stats { position: relative; background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012)); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); }
.althos-home .stats-inner { max-width: 1180px; margin: 0 auto; padding: 64px 40px; display: grid; grid-template-columns: repeat(3,1fr); align-items: center; }
.althos-home .stat { text-align: center; padding: 6px 28px; position: relative; }
.althos-home .stat + .stat::before { content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 1px; height: 64px; background: linear-gradient(180deg, transparent, var(--line-strong), transparent); }
.althos-home .stat-num { font-weight: 700; letter-spacing: -0.03em; font-size: clamp(48px,6vw,84px); line-height: 1; color: var(--accent-bright); font-variant-numeric: tabular-nums; text-shadow: 0 0 38px var(--accent-glow); }
.althos-home .stat-num .unit { font-size: 0.62em; letter-spacing: -0.02em; margin-left: 1px; }
.althos-home .stat-label { margin-top: 14px; font-size: clamp(14px,1.1vw,16px); color: var(--ink-dim); font-weight: 500; letter-spacing: 0.005em; }
@media (max-width: 760px) {
  .althos-home .stats-inner { grid-template-columns: 1fr; gap: 44px; padding: 48px 40px; }
  .althos-home .stat + .stat::before { left: 50%; top: 0; transform: translateX(-50%); width: 80px; height: 1px; background: linear-gradient(90deg, transparent, var(--line-strong), transparent); }
}

/* Social proof */
.althos-home .proof { position: relative; max-width: 1280px; margin: 0 auto; padding: 96px 40px 110px; }
.althos-home .proof-eyebrow { text-align: center; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 40px; }
.althos-home .marquee { position: relative; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.althos-home .marquee-track { display: flex; width: max-content; gap: 64px; align-items: center; animation: ah-scroll 38s linear infinite; }
.althos-home .marquee:hover .marquee-track { animation-play-state: paused; }
@keyframes ah-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.althos-home .logo-item { display: flex; align-items: center; gap: 11px; flex: 0 0 auto; color: var(--ink-faint); opacity: 0.62; transition: opacity 0.3s var(--ease), color 0.3s var(--ease); }
.althos-home .marquee:hover .logo-item { opacity: 0.4; }
.althos-home .marquee .logo-item:hover { opacity: 1; color: var(--ink-dim); }
.althos-home .logo-item .glyph { width: 26px; height: 26px; flex: 0 0 auto; display: grid; place-items: center; }
.althos-home .logo-item .glyph svg { width: 100%; height: 100%; display: block; }
.althos-home .logo-item .lname { font-size: 19px; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
.althos-home .tcards { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-top: 80px; }
.althos-home .tcard { background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.018)); border: 1px solid var(--line); border-radius: 18px; padding: 28px 26px 26px; display: flex; flex-direction: column; transition: border-color 0.3s var(--ease), transform 0.3s var(--ease); }
.althos-home .tcard:hover { border-color: var(--line-strong); transform: translateY(-3px); }
.althos-home .stars { display: flex; gap: 3px; color: var(--accent-bright); margin-bottom: 16px; }
.althos-home .stars svg { width: 16px; height: 16px; }
.althos-home .tquote { font-weight: 500; font-size: 20px; line-height: 1.42; letter-spacing: -0.01em; color: var(--ink); text-wrap: pretty; margin: 0 0 22px; }
.althos-home .tresult { margin-bottom: 22px; padding: 14px 16px; border-radius: 12px; background: linear-gradient(180deg, rgba(59,130,246,0.10), rgba(59,130,246,0.03)); border: 1px solid rgba(59,130,246,0.22); display: flex; align-items: baseline; gap: 10px; }
.althos-home .tresult .big { font-weight: 700; font-size: 28px; letter-spacing: -0.02em; color: var(--accent-bright); text-shadow: 0 0 24px var(--accent-glow); line-height: 1; }
.althos-home .tresult .rlabel { font-size: 13.5px; color: var(--ink-dim); font-weight: 500; line-height: 1.3; }
.althos-home .tmeta { display: flex; align-items: center; gap: 13px; margin-top: auto; }
.althos-home .tmeta .avatar { width: 46px; height: 46px; border-radius: 50%; flex: 0 0 auto; border: 1px solid var(--line-strong); display: grid; place-items: center; font-size: 14px; font-weight: 700; color: var(--accent-bright); background: rgba(59,130,246,0.12); }
.althos-home .tmeta .who { display: flex; flex-direction: column; gap: 2px; }
.althos-home .tmeta .name { font-size: 14.5px; font-weight: 600; color: var(--ink); letter-spacing: -0.005em; }
.althos-home .tmeta .role { font-size: 13px; color: var(--ink-faint); }
@media (max-width: 860px) {
  .althos-home .tcards { grid-template-columns: 1fr; max-width: 460px; margin-left: auto; margin-right: auto; }
}

/* Features sticky */
.althos-home .features { position: relative; max-width: 1360px; margin: 0 auto; padding: 40px 40px 120px; }
.althos-home .features-head { max-width: 720px; margin: 0 auto 20px; text-align: center; }
.althos-home .features-head .eyebrow { margin: 0 auto 22px; }
.althos-home .features-head h2 { font-weight: 800; font-size: clamp(36px,4.4vw,60px); line-height: 1.02; letter-spacing: -0.02em; color: var(--ink); text-wrap: balance; }
.althos-home .features-grid { display: grid; grid-template-columns: 0.72fr 1.55fr; gap: 56px; align-items: start; margin-top: 30px; }
.althos-home .feat-steps { display: flex; flex-direction: column; }
.althos-home .feat-step { min-height: 78vh; display: flex; flex-direction: column; justify-content: center; padding: 20px 0; }
.althos-home .feat-step .idx { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; color: var(--ink-faint); text-transform: uppercase; margin-bottom: 18px; }
.althos-home .feat-step .idx .n { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; border: 1px solid var(--line-strong); background: rgba(255,255,255,0.03); font-variant-numeric: tabular-nums; color: var(--ink-dim); font-size: 12.5px; transition: all 0.4s var(--ease); }
.althos-home .feat-step.active .idx .n { border-color: var(--accent); color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 0 18px var(--accent-glow); }
.althos-home .feat-step h3 { font-weight: 800; font-size: clamp(30px,3.4vw,46px); line-height: 1.05; letter-spacing: -0.02em; color: var(--ink-dim); transition: color 0.4s var(--ease); text-wrap: balance; }
.althos-home .feat-step.active h3 { color: var(--ink); }
.althos-home .feat-step p { margin-top: 18px; font-size: 18.5px; line-height: 1.6; color: var(--ink-dim); max-width: 30em; transition: color 0.4s var(--ease); }
.althos-home .feat-step.active p { color: var(--ink); }
.althos-home .feat-step .learn { margin-top: 22px; display: inline-flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 600; color: var(--accent-bright); text-decoration: none; opacity: 0; transform: translateY(6px); transition: opacity 0.4s var(--ease), transform 0.4s var(--ease), gap 0.25s var(--ease); width: fit-content; }
.althos-home .feat-step.active .learn { opacity: 1; transform: none; }
.althos-home .feat-step .learn:hover { gap: 12px; }
.althos-home .feat-sticky { position: sticky; top: 12vh; height: 76vh; min-height: 460px; display: flex; align-items: center; }
.althos-home .feat-frame { position: relative; width: 100%; border-radius: 16px; overflow: hidden; background: var(--surface); border: 1px solid var(--line-strong); box-shadow: 0 40px 90px -34px rgba(0,0,0,0.85); }
.althos-home .feat-frame .glow { position: absolute; inset: -10% -6% -18% -6%; z-index: 0; background: radial-gradient(58% 52% at 60% 40%, var(--accent-glow), transparent 72%); filter: blur(46px); pointer-events: none; }
.althos-home .feat-frame-bar { position: relative; z-index: 1; display: flex; align-items: center; gap: 7px; padding: 12px 15px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent); }
.althos-home .feat-frame-bar i { width: 10px; height: 10px; border-radius: 50%; background: #2c3242; }
.althos-home .feat-shots { position: relative; z-index: 1; aspect-ratio: 1820 / 862; background: #0d1018; }
.althos-home .feat-shots img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: center; opacity: 0; transition: opacity 0.5s var(--ease); cursor: zoom-in; }
.althos-home .feat-shots img.active { opacity: 1; }
@media (max-width: 900px) {
  .althos-home .features-grid { grid-template-columns: 1fr; gap: 8px; }
  .althos-home .feat-sticky { position: sticky; top: 70px; height: auto; min-height: 0; order: -1; margin-bottom: 12px; }
  .althos-home .feat-shots { aspect-ratio: 1820 / 862; height: auto; min-height: 0; }
  .althos-home .feat-step { min-height: 0; padding: 40px 0; }
}

/* AI block */
.althos-home .ai { position: relative; padding: 96px 0 110px; border-top: 1px solid var(--line); overflow: hidden; }
.althos-home .ai .ai-glow { position: absolute; left: 50%; top: 42%; transform: translate(-50%,-50%); width: 70vw; height: 70vw; max-width: 900px; max-height: 900px; background: radial-gradient(circle at 50% 50%, var(--accent-glow), transparent 62%); filter: blur(50px); z-index: 0; pointer-events: none; animation: ah-breathe 7s ease-in-out infinite; }
@keyframes ah-breathe { 0%,100% { opacity: 0.55; transform: translate(-50%,-50%) scale(1); } 50% { opacity: 0.85; transform: translate(-50%,-50%) scale(1.08); } }
.althos-home .ai canvas.sparkles { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0.7; }
.althos-home .ai-inner { position: relative; z-index: 2; max-width: 1280px; margin: 0 auto; padding: 0 40px; }
.althos-home .ai-head { max-width: 760px; margin: 0 auto 56px; text-align: center; }
.althos-home .ai-head .eyebrow { margin: 0 auto 22px; }
.althos-home .ai-head h2 { font-weight: 800; font-size: clamp(38px,5vw,68px); line-height: 1.05; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.althos-home .ai-head p { margin-top: 20px; font-size: 18px; line-height: 1.55; color: var(--ink-dim); max-width: 34em; margin-left: auto; margin-right: auto; }
.althos-home .ai-grid { display: grid; grid-template-columns: 1fr 1.12fr; gap: 52px; align-items: center; }
.althos-home .ai-list { display: flex; flex-direction: column; gap: 12px; }
.althos-home .ai-cap { display: flex; align-items: flex-start; gap: 16px; padding: 20px 22px; border-radius: 14px; border: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,0.022), transparent); cursor: default; transition: border-color 0.3s var(--ease), background 0.3s var(--ease), transform 0.3s var(--ease); }
.althos-home .ai-cap:hover { border-color: rgba(59,130,246,0.4); background: linear-gradient(180deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02)); transform: translateX(4px); }
.althos-home .ai-cap .tick { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; border: 1px solid var(--line-strong); background: rgba(255,255,255,0.03); color: var(--ink-dim); transition: all 0.3s var(--ease); }
.althos-home .ai-cap:hover .tick { border-color: var(--accent); color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 0 18px var(--accent-glow); }
.althos-home .ai-cap .tick svg { width: 18px; height: 18px; }
.althos-home .ai-cap .ctext h4 { font-size: 18.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 5px; }
.althos-home .ai-cap .ctext span { font-size: 15px; color: var(--ink-dim); line-height: 1.5; }
.althos-home .ai-mock { position: relative; }
.althos-home .ai-mock .glow { position: absolute; inset: -8% -4% -14% -4%; z-index: 0; background: radial-gradient(56% 50% at 55% 42%, var(--accent-glow), transparent 70%); filter: blur(44px); pointer-events: none; }
.althos-home .ai-frame { position: relative; z-index: 1; border-radius: 16px; overflow: hidden; background: var(--surface); border: 1px solid var(--line-strong); box-shadow: 0 40px 90px -34px rgba(0,0,0,0.85); }
.althos-home .ai-frame-bar { display: flex; align-items: center; gap: 7px; padding: 12px 15px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent); }
.althos-home .ai-frame-bar i { width: 10px; height: 10px; border-radius: 50%; background: #2c3242; }
.althos-home .ai-frame-bar .tag { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--accent-bright); }
.althos-home .ai-frame-bar .tag .pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-bright); box-shadow: 0 0 8px var(--accent-glow); animation: ah-pulse 1.4s ease-in-out infinite; }
@keyframes ah-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
.althos-home .ai-shot { position: relative; background: #0d1018; }
.althos-home .ai-shot img { width: 100%; display: block; object-fit: contain; cursor: zoom-in; }
.althos-home .ai-scan { position: absolute; left: 0; right: 0; top: 0; height: 40%; background: linear-gradient(180deg, transparent, rgba(59,130,246,0.10) 70%, rgba(59,130,246,0.18)); border-bottom: 1px solid rgba(59,130,246,0.35); box-shadow: 0 6px 24px rgba(59,130,246,0.25); animation: ah-scan 3.4s var(--ease) infinite; pointer-events: none; mix-blend-mode: screen; }
@keyframes ah-scan { 0% { transform: translateY(-100%); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(250%); opacity: 0; } }
.althos-home .ai-typingbar { position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 11px; background: rgba(12,14,22,0.82); backdrop-filter: blur(8px); border: 1px solid rgba(59,130,246,0.28); box-shadow: 0 8px 30px -10px rgba(0,0,0,0.7); }
.althos-home .ai-typingbar .spark { color: var(--accent-bright); flex: 0 0 auto; }
.althos-home .ai-typingbar .txt { font-size: 13.5px; color: var(--ink-dim); }
.althos-home .ai-typingbar .txt b { color: var(--ink); font-weight: 600; }
.althos-home .ai-typingbar .caret { display: inline-block; width: 2px; height: 1.05em; vertical-align: text-bottom; background: var(--accent-bright); margin-left: 1px; animation: ah-caret 1s steps(1) infinite; }
@keyframes ah-caret { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
@media (max-width: 900px) {
  .althos-home .ai-grid { grid-template-columns: 1fr; gap: 40px; }
  .althos-home .ai-mock { order: -1; }
}

/* Segments bento */
.althos-home .seg { position: relative; max-width: 1280px; margin: 0 auto; padding: 96px 40px 110px; border-top: 1px solid var(--line); }
.althos-home .seg-head { max-width: 760px; margin: 0 auto 52px; text-align: center; }
.althos-home .seg-head .eyebrow { margin: 0 auto 22px; }
.althos-home .seg-head h2 { font-weight: 800; font-size: clamp(36px,4.6vw,62px); line-height: 1.02; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.althos-home .bento { display: grid; grid-template-columns: repeat(3,1fr); grid-auto-rows: 1fr; gap: 16px; }
.althos-home .bento-card { position: relative; overflow: hidden; border-radius: 18px; padding: 28px; border: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012)); min-height: 200px; display: flex; flex-direction: column; transition: border-color 0.3s var(--ease), transform 0.3s var(--ease); }
.althos-home .bento-card:hover { border-color: var(--line-strong); transform: translateY(-3px); }
.althos-home .bento-card::before { content: ""; position: absolute; inset: 0; z-index: 0; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity 0.35s var(--ease); background: radial-gradient(260px circle at var(--mx,50%) var(--my,50%), rgba(59,130,246,0.16), transparent 60%); }
.althos-home .bento-card:hover::before { opacity: 1; }
.althos-home .bento-card > * { position: relative; z-index: 1; }
.althos-home .bento-card.lead { grid-column: span 2; grid-row: span 2; background: radial-gradient(120% 90% at 80% 10%, rgba(59,130,246,0.14), transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)); border-color: rgba(59,130,246,0.28); }
.althos-home .seg-icon { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; border: 1px solid var(--line-strong); background: rgba(59,130,246,0.10); color: var(--accent-bright); margin-bottom: 18px; }
.althos-home .bento-card.lead .seg-icon { width: 54px; height: 54px; }
.althos-home .seg-icon svg { width: 22px; height: 22px; }
.althos-home .bento-card.lead .seg-icon svg { width: 26px; height: 26px; }
.althos-home .seg-tag { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent-bright); margin-bottom: 12px; display: inline-block; }
.althos-home .bento-card h3 { font-weight: 800; letter-spacing: -0.015em; font-size: 29px; line-height: 1.08; color: var(--ink); margin-bottom: 10px; }
.althos-home .bento-card.lead h3 { font-size: clamp(34px,3.4vw,48px); }
.althos-home .bento-card p { font-size: 16px; line-height: 1.55; color: var(--ink-dim); max-width: 32em; }
.althos-home .bento-card.lead p { font-size: 17.5px; color: var(--ink-dim); max-width: 24em; margin-top: auto; }
.althos-home .bento-card .spacer { flex: 1; }
@media (max-width: 900px) {
  .althos-home .bento { grid-template-columns: repeat(2,1fr); }
  .althos-home .bento-card.lead { grid-column: span 2; grid-row: span 1; }
}
@media (max-width: 580px) {
  .althos-home .bento { grid-template-columns: 1fr; }
  .althos-home .bento-card.lead { grid-column: span 1; }
}

/* Pricing */
.althos-home .pricing { position: relative; max-width: 1280px; margin: 0 auto; padding: 96px 40px 110px; border-top: 1px solid var(--line); }
.althos-home .pricing-head { text-align: center; margin-bottom: 38px; }
.althos-home .pricing-head .eyebrow { margin: 0 auto 22px; }
.althos-home .pricing-head h2 { font-weight: 800; font-size: clamp(36px,4.6vw,62px); line-height: 1.02; letter-spacing: -0.025em; color: var(--ink); }
.althos-home .billing-toggle { display: inline-flex; align-items: center; gap: 4px; margin: 30px auto 0; padding: 5px; border-radius: 999px; border: 1px solid var(--line-strong); background: rgba(255,255,255,0.03); }
.althos-home .billing-toggle button { font-size: 14px; font-weight: 600; color: var(--ink-dim); background: none; border: none; cursor: pointer; padding: 9px 18px; border-radius: 999px; display: inline-flex; align-items: center; gap: 8px; transition: color 0.25s var(--ease), background 0.3s var(--ease); }
.althos-home .billing-toggle button.active { color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 4px 16px -4px var(--accent-glow); }
.althos-home .save-pill { display: block; width: fit-content; margin: 18px auto 0; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; letter-spacing: 0.005em; color: var(--accent-bright); background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.28); }
.althos-home .plans { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-top: 48px; align-items: start; }
.althos-home .plan { position: relative; border-radius: 18px; padding: 28px 24px; border: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); display: flex; flex-direction: column; }
.althos-home .plan.popular { background: linear-gradient(180deg, rgba(59,130,246,0.08), rgba(255,255,255,0.012)); transform: translateY(-10px); z-index: 1; }
.althos-home .plan.popular::before { content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1px; background: linear-gradient(120deg, transparent 20%, var(--accent-bright), #93c5fd, transparent 80%); background-size: 220% 100%; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: ah-shimmer 3.2s linear infinite; pointer-events: none; }
@keyframes ah-shimmer { from { background-position: 220% 0; } to { background-position: -20% 0; } }
.althos-home .plan-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em; padding: 5px 13px; border-radius: 999px; white-space: nowrap; color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 6px 20px -6px var(--accent-glow); }
.althos-home .plan h3 { font-size: 16px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em; }
.althos-home .plan .ptag { font-size: 14px; color: var(--ink-dim); margin-top: 5px; min-height: 20px; line-height: 1.4; }
.althos-home .plan .price { display: flex; align-items: baseline; gap: 4px; margin: 18px 0 4px; }
.althos-home .plan .price .cur { font-size: 22px; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }
.althos-home .plan .price .val { font-weight: 800; letter-spacing: -0.03em; font-size: 40px; line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums; }
.althos-home .plan .price .per { font-size: 14px; color: var(--ink-faint); align-self: flex-end; margin-bottom: 4px; }
.althos-home .plan .annual-note { font-size: 13px; color: var(--ink-faint); min-height: 18px; }
.althos-home .plan .pdesc { font-size: 14px; line-height: 1.5; color: var(--ink-dim); margin-top: 16px; min-height: 63px; }
.althos-home .plan .btn { width: 100%; justify-content: center; margin: 20px 0 0; }
.althos-home .plan .btn-outline { background: rgba(255,255,255,0.02); }
.althos-home .plan ul { display: flex; flex-direction: column; gap: 13px; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--line); }
.althos-home .plan li { display: flex; align-items: flex-start; gap: 10px; font-size: 14.5px; color: var(--ink-dim); line-height: 1.4; }
.althos-home .plan li svg { width: 17px; height: 17px; flex: 0 0 auto; margin-top: 1px; color: var(--accent-bright); }
.althos-home .plan li.off { color: var(--ink-faint); text-decoration: line-through; text-decoration-color: rgba(255,255,255,0.25); }
.althos-home .plan li.off svg { color: var(--ink-faint); opacity: 0.7; }
.althos-home .price-note { max-width: 880px; margin: 36px auto 0; text-align: center; font-size: 14px; line-height: 1.6; color: var(--ink-faint); }
.althos-home .price-note b { color: var(--ink-dim); font-weight: 600; }
.althos-home .seals { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 52px; }
.althos-home .seal { display: inline-flex; align-items: center; gap: 9px; padding: 11px 18px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,0.022); font-size: 13.5px; font-weight: 500; color: var(--ink-dim); }
.althos-home .seal svg { width: 16px; height: 16px; color: var(--accent-bright); }
@media (max-width: 980px) {
  .althos-home .plans { grid-template-columns: repeat(2,1fr); }
  .althos-home .plan.popular { transform: none; }
}
@media (max-width: 520px) {
  .althos-home .plans { grid-template-columns: 1fr; }
}

/* Final CTA */
.althos-home .final { position: relative; overflow: hidden; border-top: 1px solid var(--line); padding: 130px 40px 140px; text-align: center; }
.althos-home .final .aurora-strong { position: absolute; inset: -30% -10% -10%; z-index: 0; pointer-events: none; filter: blur(60px); }
.althos-home .final .aurora-strong span { position: absolute; border-radius: 50%; mix-blend-mode: screen; }
.althos-home .final .aurora-strong .s1 { width: 60vw; height: 60vw; max-width: 760px; max-height: 760px; left: 50%; top: 46%; transform: translate(-50%,-50%); background: radial-gradient(circle at 50% 50%, rgba(59,130,246,0.7), transparent 60%); animation: ah-breathe 8s ease-in-out infinite; }
.althos-home .final .aurora-strong .s2 { width: 40vw; height: 40vw; left: 22%; top: 30%; background: radial-gradient(circle at 50% 50%, rgba(29,78,216,0.5), transparent 62%); animation: ah-drift1 30s var(--ease) infinite alternate; }
.althos-home .final .aurora-strong .s3 { width: 38vw; height: 38vw; right: 16%; bottom: 6%; background: radial-gradient(circle at 50% 50%, rgba(96,165,250,0.45), transparent 64%); animation: ah-drift2 34s var(--ease) infinite alternate; }
.althos-home .final .vignette { position: absolute; inset: 0; z-index: 1; pointer-events: none; background: radial-gradient(120% 100% at 50% 50%, transparent 38%, rgba(10,14,26,0.55) 72%, var(--bg) 100%); }
.althos-home .final-inner { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; }
.althos-home .final h2 { font-weight: 800; font-size: clamp(44px,6vw,86px); line-height: 1.04; letter-spacing: -0.03em; color: var(--ink); text-wrap: balance; }
.althos-home .final h2 em { font-style: italic; background: linear-gradient(100deg, var(--accent-bright), #93c5fd); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.althos-home .final p { margin: 24px auto 0; font-size: clamp(17px,1.5vw,20px); line-height: 1.5; color: var(--ink-dim); max-width: 30em; }
.althos-home .final .btn { margin-top: 40px; font-size: 17px; padding: 17px 32px; border-radius: 14px; }
.althos-home .final .micro { margin-top: 18px; font-size: 14px; color: var(--ink-faint); font-weight: 500; display: inline-flex; align-items: center; gap: 8px; }
.althos-home .final .micro .check { color: var(--accent-bright); }

/* Entrance animation */
.althos-home .reveal { opacity: 0; transform: translateY(26px); transition: opacity 0.6s var(--ease), transform 0.6s var(--ease); }
.althos-home .reveal.in { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .althos-home .reveal { opacity: 1 !important; transform: none !important; transition: none; }
  .althos-home .aurora span, .althos-home .grain, .althos-home .ai-glow, .althos-home .ai-scan, .althos-home .marquee-track, .althos-home .plan.popular::before { animation: none !important; }
  .althos-home .browser { transition: none !important; }
}

/* Lightbox (zoom ao clicar nas telas) */
.althos-home .ah-lightbox { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 4vh 4vw; background: rgba(6,9,18,0.86); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); cursor: zoom-out; animation: ah-lb-fade 0.22s var(--ease); }
@keyframes ah-lb-fade { from { opacity: 0; } to { opacity: 1; } }
.althos-home .ah-lightbox img { max-width: 100%; max-height: 92vh; width: auto; height: auto; border-radius: 14px; border: 1px solid var(--line-strong); box-shadow: 0 50px 120px -30px rgba(0,0,0,0.9); animation: ah-lb-pop 0.26s var(--ease); }
@keyframes ah-lb-pop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.althos-home .ah-lightbox .ah-lb-close { position: absolute; top: 18px; right: 22px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line-strong); background: rgba(255,255,255,0.06); color: #fff; font-size: 22px; line-height: 1; display: grid; place-items: center; cursor: pointer; transition: background 0.2s var(--ease), transform 0.2s var(--ease); }
.althos-home .ah-lightbox .ah-lb-close:hover { background: rgba(255,255,255,0.14); transform: scale(1.06); }
@media (prefers-reduced-motion: reduce) {
  .althos-home .ah-lightbox, .althos-home .ah-lightbox img { animation: none; }
}

/* ============================================================
   MOBILE / TELEFONE  (<= 640px)
   Compacta tudo: tipografia menor, paddings curtos, cards
   enxutos, telas inteiras (sem corte) e ZERO scroll infinito.
   ============================================================ */
@media (max-width: 640px) {
  /* --- Hero: cabeçalho não cortado, letras menores --- */
  .althos-home .hero { padding: 18px 20px 56px; gap: 30px; }
  .althos-home .eyebrow { font-size: 12px; padding: 6px 12px 6px 10px; }
  .althos-home h1.headline { font-size: clamp(30px, 9vw, 40px); line-height: 1.08; margin-top: 18px; }
  .althos-home .subtitle { font-size: 15.5px; margin-top: 16px; line-height: 1.55; }
  .althos-home .cta-row { margin-top: 24px; gap: 10px; }
  .althos-home .cta-row .btn { flex: 1 1 auto; justify-content: center; padding: 13px 18px; font-size: 15px; }
  .althos-home .microcopy { margin-top: 14px; font-size: 12.5px; }
  .althos-home .chips { margin-top: 22px; gap: 6px; }
  .althos-home .chip { font-size: 12px; padding: 6px 10px; border-radius: 8px; }
  .althos-home .chip .dot { width: 5px; height: 5px; }

  /* --- Telas/screenshots: imagem INTEIRA (contain), nada cortado.
         Frame mantém o ratio nativo 1820/862 => zero letterbox. --- */
  .althos-home .panel img,
  .althos-home .feat-shots img,
  .althos-home .ai-shot img { object-fit: contain; }
  .althos-home .tabs { padding: 0 6px; }
  .althos-home .tab { font-size: 12px; padding: 11px 11px 12px; }

  /* --- Stats: numeros compactos, 3 lado a lado --- */
  .althos-home .stats-inner { grid-template-columns: repeat(3,1fr); gap: 0; padding: 28px 10px; }
  .althos-home .stat { padding: 4px 6px; }
  .althos-home .stat + .stat::before { left: 0; top: 50%; transform: translateY(-50%); width: 1px; height: 40px; background: linear-gradient(180deg, transparent, var(--line-strong), transparent); }
  .althos-home .stat-num { font-size: clamp(22px, 7.5vw, 34px); }
  .althos-home .stat-label { font-size: 11px; margin-top: 6px; line-height: 1.25; }

  /* --- Proof / depoimentos: 2 lado a lado, cards compactos --- */
  .althos-home .proof { padding: 52px 16px 56px; }
  .althos-home .proof-eyebrow { margin-bottom: 26px; }
  .althos-home .tcards { grid-template-columns: repeat(2,1fr); max-width: none; margin: 32px 0 0; gap: 10px; }
  .althos-home .tcard { padding: 15px 13px; border-radius: 14px; }
  .althos-home .stars { margin-bottom: 9px; }
  .althos-home .stars svg { width: 13px; height: 13px; }
  .althos-home .tquote { font-size: 13px; line-height: 1.4; margin-bottom: 12px; }
  .althos-home .tresult { padding: 8px 10px; margin-bottom: 12px; flex-direction: column; align-items: flex-start; gap: 1px; }
  .althos-home .tresult .big { font-size: 18px; }
  .althos-home .tresult .rlabel { font-size: 11px; line-height: 1.25; }
  .althos-home .tmeta { gap: 8px; }
  .althos-home .tmeta .avatar { width: 32px; height: 32px; font-size: 11.5px; }
  .althos-home .tmeta .name { font-size: 12px; }
  .althos-home .tmeta .role { font-size: 10.5px; }

  /* --- Features: sem scroll infinito --- */
  .althos-home .features { padding: 48px 20px 60px; }
  .althos-home .features-head h2 { font-size: clamp(26px, 7.5vw, 34px); }
  .althos-home .features-grid { gap: 6px; margin-top: 22px; }
  .althos-home .feat-sticky { position: static; top: auto; height: auto; min-height: 0; margin-bottom: 18px; }
  .althos-home .feat-step { min-height: 0; padding: 22px 0; }
  .althos-home .feat-step h3 { font-size: clamp(23px, 6.5vw, 30px); }
  .althos-home .feat-step p { font-size: 15.5px; margin-top: 12px; }

  /* --- AI block --- */
  .althos-home .ai { padding: 56px 0 60px; }
  .althos-home .ai-inner { padding: 0 20px; }
  .althos-home .ai-head { margin-bottom: 36px; }
  .althos-home .ai-head h2 { font-size: clamp(28px, 8vw, 38px); }
  .althos-home .ai-head p { font-size: 15.5px; margin-top: 14px; }
  .althos-home .ai-grid { gap: 28px; }
  .althos-home .ai-list { gap: 10px; }
  .althos-home .ai-cap { padding: 16px 16px; gap: 13px; }
  .althos-home .ai-cap .ctext h4 { font-size: 16px; }
  .althos-home .ai-cap .ctext span { font-size: 14px; }

  /* --- Segments bento: 2 cards por linha, lado a lado --- */
  .althos-home .seg { padding: 52px 16px 56px; }
  .althos-home .seg-head { margin-bottom: 30px; }
  .althos-home .seg-head h2 { font-size: clamp(26px, 7.5vw, 36px); }
  .althos-home .bento { grid-template-columns: repeat(2,1fr); gap: 10px; }
  .althos-home .bento-card { padding: 16px 13px; min-height: 0; border-radius: 14px; }
  .althos-home .bento-card.lead { grid-column: span 1; grid-row: span 1; }
  .althos-home .seg-icon,
  .althos-home .bento-card.lead .seg-icon { width: 36px; height: 36px; margin-bottom: 11px; border-radius: 10px; }
  .althos-home .seg-icon svg,
  .althos-home .bento-card.lead .seg-icon svg { width: 18px; height: 18px; }
  .althos-home .seg-tag { font-size: 10.5px; margin-bottom: 7px; }
  .althos-home .bento-card h3 { font-size: 16.5px; margin-bottom: 6px; }
  .althos-home .bento-card.lead h3 { font-size: 18px; }
  .althos-home .bento-card p,
  .althos-home .bento-card.lead p { font-size: 12.5px; line-height: 1.45; max-width: none; }

  /* --- Pricing: comparação 2 a 2 lado a lado, cards compactos --- */
  .althos-home .pricing { padding: 52px 16px 60px; }
  .althos-home .pricing-head { margin-bottom: 26px; }
  .althos-home .pricing-head h2 { font-size: clamp(26px, 7.5vw, 36px); }
  .althos-home .billing-toggle { margin-top: 22px; gap: 2px; padding: 4px; }
  .althos-home .billing-toggle button { font-size: 12.5px; padding: 7px 11px; }
  .althos-home .plans { grid-template-columns: repeat(2,1fr); gap: 10px; margin-top: 28px; }
  .althos-home .plan { padding: 16px 13px; border-radius: 14px; }
  .althos-home .plan.popular { transform: none; }
  .althos-home .plan h3 { font-size: 15px; }
  .althos-home .plan .ptag { font-size: 12px; min-height: 0; margin-top: 3px; }
  .althos-home .plan .price { margin: 12px 0 2px; }
  .althos-home .plan .price .cur { font-size: 16px; }
  .althos-home .plan .price .val { font-size: 28px; }
  .althos-home .plan .price .per { font-size: 12px; }
  .althos-home .plan .annual-note { font-size: 11px; min-height: 0; }
  .althos-home .plan .pdesc { font-size: 12.5px; min-height: 0; margin-top: 12px; }
  .althos-home .plan .btn { margin-top: 14px; padding: 10px 12px; font-size: 13px; }
  .althos-home .plan ul { gap: 8px; margin-top: 16px; padding-top: 16px; }
  .althos-home .plan li { font-size: 12px; gap: 7px; line-height: 1.35; }
  .althos-home .plan li svg { width: 14px; height: 14px; }
  .althos-home .price-note { font-size: 12.5px; margin-top: 28px; }
  .althos-home .seals { margin-top: 32px; gap: 8px; }
  .althos-home .seal { font-size: 12px; padding: 8px 12px; }

  /* --- Final CTA --- */
  .althos-home .final { padding: 72px 20px 84px; }
  .althos-home .final h2 { font-size: clamp(32px, 9vw, 46px); }
  .althos-home .final p { font-size: 16px; margin-top: 18px; }
  .althos-home .final .btn { margin-top: 30px; font-size: 16px; padding: 15px 26px; }
}
`
