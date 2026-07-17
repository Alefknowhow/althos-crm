/**
 * CSS escopado da landing AlthosHome. TODAS as regras são prefixadas com
 * `.althos-home` (sem resets globais `*`/`body`) para não vazar para o
 * header/footer (SiteShell) nem para outras páginas.
 *
 * Tema CLARO inspirado no Attio: fundo branco, muito respiro, tipografia
 * grotesk, superfícies brancas com sombras suaves, gradientes pastel
 * discretos e acento INDIGO da Althos (#4f46e5).
 */
export const HOME_CSS = `
.althos-home {
  --bg: #ffffff;
  --surface: #ffffff;
  --surface-2: #f6f7f9;
  --ink: #15171c;
  --ink-dim: #51555e;
  --ink-faint: #8a8f99;
  --line: rgba(17,20,28,0.09);
  --line-strong: rgba(17,20,28,0.14);
  --accent: #4f46e5;
  --accent-bright: #6366f1;
  --accent-deep: #4338ca;
  --accent-glow: rgba(79,70,229,0.20);
  --shadow-sm: 0 1px 2px rgba(17,20,28,0.05), 0 1px 3px rgba(17,20,28,0.04);
  --shadow-card: 0 1px 2px rgba(17,20,28,0.04), 0 18px 40px -20px rgba(17,20,28,0.18);
  --shadow-float: 0 2px 6px rgba(17,20,28,0.05), 0 40px 80px -30px rgba(17,20,28,0.28);
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --sans: "Hanken Grotesk", -apple-system, system-ui, sans-serif;
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
.althos-home .aurora .a1 { width: 55vw; height: 55vw; left: 8%; top: -14%; background: radial-gradient(circle at 50% 50%, rgba(99,102,241,0.20), transparent 62%); animation: ah-drift1 26s var(--ease) infinite alternate; }
.althos-home .aurora .a2 { width: 48vw; height: 48vw; right: -6%; top: 6%; background: radial-gradient(circle at 50% 50%, rgba(129,140,248,0.16), transparent 62%); animation: ah-drift2 32s var(--ease) infinite alternate; }
.althos-home .aurora .a3 { width: 42vw; height: 42vw; left: 34%; top: 24%; background: radial-gradient(circle at 50% 50%, rgba(165,180,252,0.16), transparent 64%); animation: ah-drift3 38s var(--ease) infinite alternate; }
@keyframes ah-drift1 { 0% { transform: translate3d(0,0,0) scale(1); } 100% { transform: translate3d(6%,5%,0) scale(1.12); } }
@keyframes ah-drift2 { 0% { transform: translate3d(0,0,0) scale(1.05); } 100% { transform: translate3d(-5%,7%,0) scale(0.95); } }
@keyframes ah-drift3 { 0% { transform: translate3d(0,0,0) scale(0.95); } 100% { transform: translate3d(4%,-6%,0) scale(1.1); } }

.althos-home .bg-fade { position: fixed; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(180deg, rgba(255,255,255,0.7) 0%, transparent 24%, transparent 70%, var(--bg) 100%); }
.althos-home .grain { position: fixed; inset: 0; z-index: 2; pointer-events: none; opacity: 0.025; mix-blend-mode: multiply; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); animation: ah-grain 6s steps(4) infinite; }
@keyframes ah-grain { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-4%,3%); } 50% { transform: translate(3%,-2%); } 75% { transform: translate(-2%,-4%); } }

.althos-home .shell { position: relative; z-index: 5; }

/* Hero */
.althos-home .hero { max-width: 1120px; margin: 0 auto; padding: 56px 40px 96px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 60px; }
.althos-home .hero-copy { display: flex; flex-direction: column; align-items: center; width: 100%; }
.althos-home .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px 7px 12px; border-radius: 999px; border: 1px solid var(--line-strong); background: linear-gradient(180deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02)); font-size: 13px; font-weight: 600; letter-spacing: 0.01em; color: var(--accent-deep); width: fit-content; box-shadow: var(--shadow-sm); }
.althos-home .eyebrow .star { color: var(--accent); font-size: 12px; line-height: 1; }
.althos-home h1.headline { font-weight: 800; font-size: clamp(46px,5.6vw,80px); line-height: 1.04; letter-spacing: -0.025em; margin-top: 26px; text-wrap: balance; color: var(--ink); max-width: 16ch; }
.althos-home h1.headline em { font-style: italic; background: linear-gradient(100deg, var(--accent-bright), var(--accent-deep)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.althos-home .subtitle { margin-top: 26px; font-size: clamp(17px,1.3vw,20px); line-height: 1.6; color: var(--ink-dim); max-width: 32em; font-weight: 400; }
.althos-home .cta-row { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-top: 36px; }
.althos-home .btn { font-size: 15.5px; font-weight: 600; letter-spacing: -0.005em; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; padding: 14px 24px; border-radius: 12px; transition: transform 0.25s var(--ease), box-shadow 0.3s var(--ease), background 0.25s var(--ease), border-color 0.25s var(--ease); }
.althos-home .btn-solid { color: #fff; border: 1px solid var(--accent); background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 8px 24px -8px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.18); }
.althos-home .btn-solid:hover { transform: translateY(-2px); box-shadow: 0 16px 36px -10px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.24); }
.althos-home .btn-solid .arrow { transition: transform 0.25s var(--ease); }
.althos-home .btn-solid:hover .arrow { transform: translateX(3px); }
.althos-home .btn-outline { color: var(--ink); border: 1px solid var(--line-strong); background: var(--surface); box-shadow: var(--shadow-sm); }
.althos-home .btn-outline:hover { border-color: var(--ink-faint); background: var(--surface-2); transform: translateY(-2px); }
.althos-home .microcopy { margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13.5px; color: var(--ink-faint); font-weight: 500; }
.althos-home .microcopy .check { color: var(--accent); }
.althos-home .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 40px; }
.althos-home .chip { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); font-size: 14.5px; font-weight: 500; color: var(--ink-dim); box-shadow: var(--shadow-sm); transition: border-color 0.25s var(--ease), color 0.25s var(--ease), background 0.25s var(--ease); }
.althos-home .chip:hover { border-color: var(--line-strong); color: var(--ink); background: var(--surface-2); }
.althos-home .chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }

/* Product mockup */
.althos-home .mock-wrap { position: relative; perspective: 1600px; display: flex; justify-content: center; width: 100%; max-width: 1000px; margin: 0 auto; }
.althos-home .mock-glow { position: absolute; inset: -8% -4% -16% -4%; background: radial-gradient(60% 55% at 60% 38%, var(--accent-glow), transparent 70%); filter: blur(50px); z-index: 0; pointer-events: none; }
.althos-home .browser { position: relative; z-index: 1; width: 100%; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-float); overflow: hidden; transform-style: preserve-3d; will-change: transform; transition: transform 0.18s var(--ease); }
.althos-home .browser-bar { display: flex; align-items: center; gap: 14px; padding: 13px 16px; border-bottom: 1px solid var(--line); background: var(--surface-2); }
.althos-home .dots { display: flex; gap: 7px; }
.althos-home .dots i { width: 11px; height: 11px; border-radius: 50%; background: #d3d6dd; display: block; }
.althos-home .url { flex: 1; max-width: 320px; margin: 0 auto; background: rgba(17,20,28,0.04); border: 1px solid var(--line); border-radius: 7px; padding: 6px 12px; font-size: 12px; color: var(--ink-faint); display: flex; align-items: center; gap: 7px; }
.althos-home .url .lock { width: 9px; height: 9px; opacity: 0.6; }
.althos-home .tabs { display: flex; align-items: stretch; gap: 2px; padding: 0 10px; border-bottom: 1px solid var(--line); background: var(--surface-2); overflow-x: auto; scrollbar-width: none; }
.althos-home .tabs::-webkit-scrollbar { display: none; }
.althos-home .tab { position: relative; flex: 0 0 auto; font-size: 13px; font-weight: 600; letter-spacing: -0.005em; color: var(--ink-faint); background: none; border: none; cursor: pointer; padding: 13px 15px 14px; white-space: nowrap; transition: color 0.22s var(--ease); }
.althos-home .tab:hover { color: var(--ink-dim); }
.althos-home .tab[aria-selected="true"] { color: var(--ink); }
.althos-home .tab::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, var(--accent-bright), var(--accent)); transform: scaleX(0); transform-origin: center; transition: transform 0.3s var(--ease); }
.althos-home .tab[aria-selected="true"]::after { transform: scaleX(1); }
.althos-home .browser-screen { position: relative; display: block; line-height: 0; background: #f3f4f6; aspect-ratio: 1820 / 862; }
.althos-home .panel { position: absolute; inset: 0; opacity: 0; visibility: hidden; transition: opacity 0.28s var(--ease); }
.althos-home .panel.active { opacity: 1; visibility: visible; }
.althos-home .panel img { width: 100%; height: 100%; display: block; object-fit: contain; object-position: center; cursor: zoom-in; }

@media (max-width: 940px) {
  .althos-home .hero { padding-top: 16px; gap: 44px; }
  .althos-home .mock-wrap { width: 100%; margin: 0 auto; }
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
.althos-home .cmp-table { border: 1px solid var(--line); border-radius: 18px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow-card); }
.althos-home .cmp-row { display: grid; grid-template-columns: minmax(0,1.8fr) 1fr 1fr 1fr; align-items: center; border-top: 1px solid var(--line); }
.althos-home .cmp-row:first-child { border-top: none; }
.althos-home .cmp-header { background: var(--surface-2); }
.althos-home .cmp-header .cmp-feat, .althos-home .cmp-header .cmp-col { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); padding-top: 18px; padding-bottom: 18px; }
.althos-home .cmp-feat { padding: 16px 20px; font-size: 14.5px; font-weight: 500; color: var(--ink-dim); line-height: 1.35; }
.althos-home .cmp-col { padding: 16px 12px; text-align: center; display: flex; align-items: center; justify-content: center; min-height: 56px; }
.althos-home .cmp-col.cmp-althos { background: linear-gradient(180deg, rgba(79,70,229,0.07), rgba(79,70,229,0.02)); position: relative; }
.althos-home .cmp-header .cmp-col.cmp-althos { color: var(--accent-deep); font-weight: 800; }
.althos-home .cmp-yes { color: var(--accent); display: grid; place-items: center; }
.althos-home .cmp-yes svg { width: 22px; height: 22px; }
.althos-home .cmp-no { color: rgba(17,20,28,0.22); display: grid; place-items: center; }
.althos-home .cmp-no svg { width: 19px; height: 19px; }
.althos-home .cmp-partial { font-size: 12.5px; font-weight: 500; color: var(--ink-faint); line-height: 1.25; }
/* Garantias / objeções */
.althos-home .guarantees { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-top: 28px; }
.althos-home .guarantee { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 16px; padding: 22px 20px; background: var(--surface); box-shadow: var(--shadow-sm); transition: border-color 0.3s var(--ease), transform 0.3s var(--ease), box-shadow 0.3s var(--ease); }
.althos-home .guarantee:hover { border-color: var(--line-strong); transform: translateY(-3px); box-shadow: var(--shadow-card); }
.althos-home .g-tick { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; border: 1px solid rgba(79,70,229,0.18); background: rgba(79,70,229,0.08); color: var(--accent); margin-bottom: 14px; }
.althos-home .g-tick svg { width: 19px; height: 19px; }
.althos-home .guarantee h4 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 7px; }
.althos-home .guarantee p { font-size: 13.5px; line-height: 1.5; color: var(--ink-dim); }
@media (max-width: 860px) {
  .althos-home .guarantees { grid-template-columns: repeat(2,1fr); }
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
.althos-home .feat-step .idx .n { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; border: 1px solid var(--line-strong); background: var(--surface); font-variant-numeric: tabular-nums; color: var(--ink-dim); font-size: 12.5px; transition: all 0.4s var(--ease); }
.althos-home .feat-step.active .idx .n { border-color: var(--accent); color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 4px 14px -4px var(--accent-glow); }
.althos-home .feat-step h3 { font-weight: 800; font-size: clamp(30px,3.4vw,46px); line-height: 1.05; letter-spacing: -0.02em; color: var(--ink-faint); transition: color 0.4s var(--ease); text-wrap: balance; }
.althos-home .feat-step.active h3 { color: var(--ink); }
.althos-home .feat-step p { margin-top: 18px; font-size: 18.5px; line-height: 1.6; color: var(--ink-faint); max-width: 30em; transition: color 0.4s var(--ease); }
.althos-home .feat-step.active p { color: var(--ink-dim); }
.althos-home .feat-step .learn { margin-top: 22px; display: inline-flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 600; color: var(--accent); text-decoration: none; opacity: 0; transform: translateY(6px); transition: opacity 0.4s var(--ease), transform 0.4s var(--ease), gap 0.25s var(--ease); width: fit-content; }
.althos-home .feat-step.active .learn { opacity: 1; transform: none; }
.althos-home .feat-step .learn:hover { gap: 12px; }
.althos-home .feat-sticky { position: sticky; top: 12vh; height: 76vh; min-height: 460px; display: flex; align-items: center; }
.althos-home .feat-frame { position: relative; width: 100%; border-radius: 16px; overflow: hidden; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-float); }
.althos-home .feat-frame .glow { position: absolute; inset: -10% -6% -18% -6%; z-index: 0; background: radial-gradient(58% 52% at 60% 40%, var(--accent-glow), transparent 72%); filter: blur(46px); pointer-events: none; }
.althos-home .feat-frame-bar { position: relative; z-index: 1; display: flex; align-items: center; gap: 7px; padding: 12px 15px; border-bottom: 1px solid var(--line); background: var(--surface-2); }
.althos-home .feat-frame-bar i { width: 10px; height: 10px; border-radius: 50%; background: #d3d6dd; }
.althos-home .feat-shots { position: relative; z-index: 1; aspect-ratio: 1820 / 862; background: #f3f4f6; }
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
@keyframes ah-breathe { 0%,100% { opacity: 0.5; transform: translate(-50%,-50%) scale(1); } 50% { opacity: 0.8; transform: translate(-50%,-50%) scale(1.08); } }
.althos-home .ai canvas.sparkles { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0.3; }
.althos-home .ai-inner { position: relative; z-index: 2; max-width: 1280px; margin: 0 auto; padding: 0 40px; }
.althos-home .ai-head { max-width: 760px; margin: 0 auto 56px; text-align: center; }
.althos-home .ai-head .eyebrow { margin: 0 auto 22px; }
.althos-home .ai-head h2 { font-weight: 800; font-size: clamp(38px,5vw,68px); line-height: 1.05; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.althos-home .ai-head p { margin-top: 20px; font-size: 18px; line-height: 1.55; color: var(--ink-dim); max-width: 34em; margin-left: auto; margin-right: auto; }
.althos-home .ai-grid { display: grid; grid-template-columns: 1fr 1.12fr; gap: 52px; align-items: center; }
.althos-home .ai-list { display: flex; flex-direction: column; gap: 12px; }
.althos-home .ai-cap { display: flex; align-items: flex-start; gap: 16px; padding: 20px 22px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-sm); cursor: default; transition: border-color 0.3s var(--ease), background 0.3s var(--ease), transform 0.3s var(--ease), box-shadow 0.3s var(--ease); }
.althos-home .ai-cap:hover { border-color: rgba(79,70,229,0.35); background: linear-gradient(180deg, rgba(79,70,229,0.05), rgba(79,70,229,0.01)); transform: translateX(4px); box-shadow: var(--shadow-card); }
.althos-home .ai-cap .tick { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--ink-dim); transition: all 0.3s var(--ease); }
.althos-home .ai-cap:hover .tick { border-color: var(--accent); color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 4px 14px -4px var(--accent-glow); }
.althos-home .ai-cap .tick svg { width: 18px; height: 18px; }
.althos-home .ai-cap .ctext h4 { font-size: 18.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 5px; }
.althos-home .ai-cap .ctext span { font-size: 15px; color: var(--ink-dim); line-height: 1.5; }
.althos-home .ai-mock { position: relative; }
.althos-home .ai-mock .glow { position: absolute; inset: -8% -4% -14% -4%; z-index: 0; background: radial-gradient(56% 50% at 55% 42%, var(--accent-glow), transparent 70%); filter: blur(44px); pointer-events: none; }
.althos-home .ai-frame { position: relative; z-index: 1; border-radius: 16px; overflow: hidden; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-float); }
.althos-home .ai-frame-bar { display: flex; align-items: center; gap: 7px; padding: 12px 15px; border-bottom: 1px solid var(--line); background: var(--surface-2); }
.althos-home .ai-frame-bar i { width: 10px; height: 10px; border-radius: 50%; background: #d3d6dd; }
.althos-home .ai-frame-bar .tag { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--accent); }
.althos-home .ai-frame-bar .tag .pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent-glow); animation: ah-pulse 1.4s ease-in-out infinite; }
@keyframes ah-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
.althos-home .ai-shot { position: relative; background: #f3f4f6; }
.althos-home .ai-shot img { width: 100%; display: block; object-fit: contain; cursor: zoom-in; }
.althos-home .ai-scan { position: absolute; left: 0; right: 0; top: 0; height: 40%; background: linear-gradient(180deg, transparent, rgba(99,102,241,0.10) 70%, rgba(99,102,241,0.18)); border-bottom: 1px solid rgba(99,102,241,0.35); box-shadow: 0 6px 24px rgba(99,102,241,0.18); animation: ah-scan 3.4s var(--ease) infinite; pointer-events: none; }
@keyframes ah-scan { 0% { transform: translateY(-100%); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(250%); opacity: 0; } }
.althos-home .ai-typingbar { position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 11px; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); border: 1px solid rgba(99,102,241,0.25); box-shadow: 0 8px 26px -10px rgba(17,20,28,0.25); }
.althos-home .ai-typingbar .spark { color: var(--accent); flex: 0 0 auto; }
.althos-home .ai-typingbar .txt { font-size: 13.5px; color: var(--ink-dim); }
.althos-home .ai-typingbar .txt b { color: var(--ink); font-weight: 600; }
.althos-home .ai-typingbar .caret { display: inline-block; width: 2px; height: 1.05em; vertical-align: text-bottom; background: var(--accent); margin-left: 1px; animation: ah-caret 1s steps(1) infinite; }
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
.althos-home .bento-card { position: relative; overflow: hidden; border-radius: 18px; padding: 28px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-sm); min-height: 200px; display: flex; flex-direction: column; transition: border-color 0.3s var(--ease), transform 0.3s var(--ease), box-shadow 0.3s var(--ease); }
.althos-home .bento-card:hover { border-color: var(--line-strong); transform: translateY(-3px); box-shadow: var(--shadow-card); }
.althos-home .bento-card::before { content: ""; position: absolute; inset: 0; z-index: 0; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity 0.35s var(--ease); background: radial-gradient(260px circle at var(--mx,50%) var(--my,50%), rgba(79,70,229,0.10), transparent 60%); }
.althos-home .bento-card:hover::before { opacity: 1; }
.althos-home .bento-card > * { position: relative; z-index: 1; }
.althos-home .bento-card.lead { grid-column: span 2; grid-row: span 2; background: radial-gradient(120% 90% at 80% 10%, rgba(79,70,229,0.08), transparent 55%), var(--surface); border-color: rgba(79,70,229,0.22); }
.althos-home .seg-icon { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; border: 1px solid rgba(79,70,229,0.18); background: rgba(79,70,229,0.08); color: var(--accent); margin-bottom: 18px; }
.althos-home .bento-card.lead .seg-icon { width: 54px; height: 54px; }
.althos-home .seg-icon svg { width: 22px; height: 22px; }
.althos-home .bento-card.lead .seg-icon svg { width: 26px; height: 26px; }
.althos-home .seg-tag { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); margin-bottom: 12px; display: inline-block; }
.althos-home .bento-card h3 { font-weight: 800; letter-spacing: -0.015em; font-size: 29px; line-height: 1.08; color: var(--ink); margin-bottom: 10px; }
.althos-home .bento-card.lead h3 { font-size: clamp(34px,3.4vw,48px); }
.althos-home .bento-card p { font-size: 16px; line-height: 1.55; color: var(--ink-dim); max-width: 32em; }
.althos-home .bento-card.lead p { font-size: 17.5px; color: var(--ink-dim); max-width: 24em; margin-top: auto; }
.althos-home .bento-card .spacer { flex: 1; }
.althos-home a.bento-card { text-decoration: none; cursor: pointer; }
.althos-home .seg-link { margin-top: 16px; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--accent); opacity: 0; transform: translateY(4px); transition: opacity 0.3s var(--ease), transform 0.3s var(--ease); }
.althos-home .bento-card:not(.lead) .seg-link { margin-top: auto; }
.althos-home .bento-card:hover .seg-link { opacity: 1; transform: translateY(0); }
.althos-home .seg-link span { transition: transform 0.25s var(--ease); }
.althos-home .bento-card:hover .seg-link span { transform: translateX(3px); }
@media (max-width: 900px) {
  .althos-home .bento { grid-template-columns: repeat(2,1fr); }
  .althos-home .bento-card.lead { grid-column: span 2; grid-row: span 1; }
}
@media (max-width: 580px) {
  .althos-home .bento { grid-template-columns: 1fr; }
  .althos-home .bento-card.lead { grid-column: span 1; }
}

/* Onboarding — passos numerados (estilo Attio "no ar em minutos") */
.althos-home .onboard { position: relative; max-width: 1180px; margin: 0 auto; padding: 96px 40px 100px; border-top: 1px solid var(--line); }
.althos-home .onboard-head { max-width: 760px; margin: 0 auto 52px; text-align: center; }
.althos-home .onboard-head .eyebrow { margin: 0 auto 22px; }
.althos-home .onboard-head h2 { font-weight: 800; font-size: clamp(32px,4.2vw,56px); line-height: 1.04; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.althos-home .onboard-head p { margin-top: 20px; font-size: clamp(16px,1.2vw,18px); line-height: 1.6; color: var(--ink-dim); }
.althos-home .steps { display: grid; grid-template-columns: repeat(5,1fr); gap: 18px; counter-reset: ah-step; }
.althos-home .step { position: relative; display: flex; flex-direction: column; gap: 14px; padding: 26px 22px 24px; border-radius: 16px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-sm); transition: transform 0.35s var(--ease), box-shadow 0.35s var(--ease), border-color 0.35s var(--ease); }
.althos-home .step:hover { transform: translateY(-3px); box-shadow: var(--shadow-card); border-color: var(--line-strong); }
.althos-home .step-n { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 11px; font-size: 15px; font-weight: 800; color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 6px 16px -6px var(--accent-glow); }
.althos-home .step h3 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); line-height: 1.25; }
.althos-home .step p { font-size: 14px; line-height: 1.55; color: var(--ink-dim); }
.althos-home .step::after { content: ""; position: absolute; top: 44px; right: -10px; width: 20px; height: 1px; background: var(--line-strong); }
.althos-home .step:last-child::after { display: none; }
@media (max-width: 980px) {
  .althos-home .steps { grid-template-columns: repeat(2,1fr); }
  .althos-home .step::after { display: none; }
}
@media (max-width: 560px) {
  .althos-home .onboard { padding: 56px 16px 60px; }
  .althos-home .onboard-head { margin-bottom: 32px; }
  .althos-home .onboard-head h2 { font-size: clamp(24px,7vw,34px); }
  .althos-home .steps { grid-template-columns: 1fr; gap: 12px; }
  .althos-home .step { flex-direction: row; align-items: flex-start; padding: 18px; }
  .althos-home .step-n { flex-shrink: 0; width: 34px; height: 34px; }
}

/* Pricing */
.althos-home .pricing { position: relative; max-width: 1280px; margin: 0 auto; padding: 96px 40px 110px; border-top: 1px solid var(--line); }
.althos-home .pricing-head { text-align: center; margin-bottom: 38px; }
.althos-home .pricing-head .eyebrow { margin: 0 auto 22px; }
.althos-home .pricing-head h2 { font-weight: 800; font-size: clamp(36px,4.6vw,62px); line-height: 1.02; letter-spacing: -0.025em; color: var(--ink); }
.althos-home .billing-toggle { display: inline-flex; align-items: center; gap: 4px; margin: 30px auto 0; padding: 5px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface-2); }
.althos-home .billing-toggle button { font-size: 14px; font-weight: 600; color: var(--ink-dim); background: none; border: none; cursor: pointer; padding: 9px 18px; border-radius: 999px; display: inline-flex; align-items: center; gap: 8px; transition: color 0.25s var(--ease), background 0.3s var(--ease); }
.althos-home .billing-toggle button.active { color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 4px 14px -4px var(--accent-glow); }
.althos-home .save-pill { display: block; width: fit-content; margin: 18px auto 0; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; letter-spacing: 0.005em; color: var(--accent-deep); background: rgba(79,70,229,0.10); border: 1px solid rgba(79,70,229,0.24); }
.althos-home .plans { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-top: 48px; align-items: start; }
.althos-home .plan { position: relative; border-radius: 18px; padding: 28px 24px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; }
.althos-home .plan.popular { background: linear-gradient(180deg, rgba(79,70,229,0.05), var(--surface)); box-shadow: var(--shadow-card); transform: translateY(-10px); z-index: 1; }
.althos-home .plan.popular::before { content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1px; background: linear-gradient(120deg, transparent 20%, var(--accent-bright), #a5b4fc, transparent 80%); background-size: 220% 100%; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: ah-shimmer 3.2s linear infinite; pointer-events: none; }
@keyframes ah-shimmer { from { background-position: 220% 0; } to { background-position: -20% 0; } }
.althos-home .plan-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em; padding: 5px 13px; border-radius: 999px; white-space: nowrap; color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 6px 18px -6px var(--accent-glow); }
.althos-home .plan h3 { font-size: 16px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em; }
.althos-home .plan .ptag { font-size: 14px; color: var(--ink-dim); margin-top: 5px; min-height: 20px; line-height: 1.4; }
.althos-home .plan .price { display: flex; align-items: baseline; gap: 4px; margin: 18px 0 4px; }
.althos-home .plan .price .cur { font-size: 22px; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }
.althos-home .plan .price .val { font-weight: 800; letter-spacing: -0.03em; font-size: 40px; line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums; }
.althos-home .plan .price .per { font-size: 14px; color: var(--ink-faint); align-self: flex-end; margin-bottom: 4px; }
.althos-home .plan .annual-note { font-size: 13px; color: var(--ink-faint); min-height: 18px; }
.althos-home .plan .pdesc { font-size: 14px; line-height: 1.5; color: var(--ink-dim); margin-top: 16px; min-height: 63px; }
.althos-home .plan .btn { width: 100%; justify-content: center; margin: 20px 0 0; }
.althos-home .plan .btn-outline { background: var(--surface); }
.althos-home .plan ul { display: flex; flex-direction: column; gap: 13px; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--line); }
.althos-home .plan li { display: flex; align-items: flex-start; gap: 10px; font-size: 14.5px; color: var(--ink-dim); line-height: 1.4; }
.althos-home .plan li svg { width: 17px; height: 17px; flex: 0 0 auto; margin-top: 1px; color: var(--accent); }
.althos-home .plan li.off { color: var(--ink-faint); text-decoration: line-through; text-decoration-color: rgba(17,20,28,0.25); }
.althos-home .plan li.off svg { color: var(--ink-faint); opacity: 0.7; }
.althos-home .price-note { max-width: 880px; margin: 36px auto 0; text-align: center; font-size: 14px; line-height: 1.6; color: var(--ink-faint); }
.althos-home .price-note b { color: var(--ink-dim); font-weight: 600; }
.althos-home .seals { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 52px; }
.althos-home .seal { display: inline-flex; align-items: center; gap: 9px; padding: 11px 18px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-sm); font-size: 13.5px; font-weight: 500; color: var(--ink-dim); }
.althos-home .seal svg { width: 16px; height: 16px; color: var(--accent); }
@media (max-width: 980px) {
  .althos-home .plans { grid-template-columns: repeat(2,1fr); }
  .althos-home .plan.popular { transform: none; }
}
@media (max-width: 520px) {
  .althos-home .plans { grid-template-columns: 1fr; }
}

/* Final CTA */
.althos-home .final { position: relative; overflow: hidden; border-top: 1px solid var(--line); padding: 130px 40px 140px; text-align: center; background: var(--surface-2); }
.althos-home .final .aurora-strong { position: absolute; inset: -30% -10% -10%; z-index: 0; pointer-events: none; filter: blur(78px); opacity: 0.5; }
.althos-home .final .aurora-strong span { position: absolute; border-radius: 50%; }
.althos-home .final .aurora-strong .s1 { width: 60vw; height: 60vw; max-width: 760px; max-height: 760px; left: 50%; top: 46%; transform: translate(-50%,-50%); background: radial-gradient(circle at 50% 50%, rgba(99,102,241,0.22), transparent 60%); animation: ah-breathe 8s ease-in-out infinite; }
.althos-home .final .aurora-strong .s2 { width: 40vw; height: 40vw; left: 22%; top: 30%; background: radial-gradient(circle at 50% 50%, rgba(129,140,248,0.18), transparent 62%); animation: ah-drift1 30s var(--ease) infinite alternate; }
.althos-home .final .aurora-strong .s3 { width: 38vw; height: 38vw; right: 16%; bottom: 6%; background: radial-gradient(circle at 50% 50%, rgba(165,180,252,0.18), transparent 64%); animation: ah-drift2 34s var(--ease) infinite alternate; }
.althos-home .final .vignette { position: absolute; inset: 0; z-index: 1; pointer-events: none; background: radial-gradient(120% 100% at 50% 50%, transparent 42%, rgba(246,247,249,0.6) 74%, var(--surface-2) 100%); }
.althos-home .final-inner { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; }
.althos-home .final h2 { font-weight: 800; font-size: clamp(44px,6vw,86px); line-height: 1.04; letter-spacing: -0.03em; color: var(--ink); text-wrap: balance; }
.althos-home .final h2 em { font-style: italic; background: linear-gradient(100deg, var(--accent-bright), var(--accent-deep)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.althos-home .final p { margin: 24px auto 0; font-size: clamp(17px,1.5vw,20px); line-height: 1.5; color: var(--ink-dim); max-width: 30em; }
.althos-home .final .btn { margin-top: 40px; font-size: 17px; padding: 17px 32px; border-radius: 14px; }
.althos-home .final .micro { margin-top: 18px; font-size: 14px; color: var(--ink-faint); font-weight: 500; display: inline-flex; align-items: center; gap: 8px; }
.althos-home .final .micro .check { color: var(--accent); }

/* GEO / conteúdo enciclopédico (o que é, para quem, diferenciais) */
.althos-home .geo { position: relative; max-width: 1080px; margin: 0 auto; padding: 96px 40px 20px; border-top: 1px solid var(--line); }
.althos-home .geo-head { max-width: 760px; margin: 0 auto 32px; text-align: center; }
.althos-home .geo-head .eyebrow { margin: 0 auto 22px; }
.althos-home .geo-head h2 { font-weight: 800; font-size: clamp(32px,4.2vw,52px); line-height: 1.05; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.althos-home .geo-intro { max-width: 720px; margin: 0 auto 40px; font-size: 16px; line-height: 1.7; color: var(--ink-dim); text-align: center; }
.althos-home .geo-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; }
.althos-home .geo-card { border: 1px solid var(--line); border-radius: 16px; padding: 24px 22px; background: var(--surface); box-shadow: var(--shadow-sm); }
.althos-home .geo-card h3 { font-size: 16px; font-weight: 700; color: var(--ink); margin-bottom: 8px; letter-spacing: -0.005em; }
.althos-home .geo-card p { font-size: 14px; line-height: 1.65; color: var(--ink-dim); }

/* FAQ */
.althos-home .faq { position: relative; max-width: 820px; margin: 0 auto; padding: 60px 40px 110px; }
.althos-home .faq-head { text-align: center; margin-bottom: 36px; }
.althos-home .faq-head .eyebrow { margin: 0 auto 22px; }
.althos-home .faq-head h2 { font-weight: 800; font-size: clamp(30px,3.6vw,44px); line-height: 1.06; letter-spacing: -0.02em; color: var(--ink); text-wrap: balance; }
.althos-home .faq-list { display: flex; flex-direction: column; gap: 10px; }
.althos-home .faq-item { border: 1px solid var(--line); border-radius: 14px; background: var(--surface); padding: 4px 20px; box-shadow: var(--shadow-sm); transition: border-color 0.25s var(--ease); }
.althos-home .faq-item[open] { border-color: var(--line-strong); }
.althos-home .faq-item summary { cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; font-size: 15px; font-weight: 600; color: var(--ink); }
.althos-home .faq-item summary::-webkit-details-marker { display: none; }
.althos-home .faq-item summary .plus { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--line-strong); display: grid; place-items: center; color: var(--ink-dim); transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), color 0.25s var(--ease); }
.althos-home .faq-item[open] summary .plus { transform: rotate(45deg); border-color: var(--accent); color: var(--accent); }
.althos-home .faq-item p { padding: 0 0 18px; font-size: 14px; line-height: 1.6; color: var(--ink-dim); }

/* Entrance animation */
.althos-home .reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.55s var(--ease), transform 0.55s var(--ease); }
.althos-home .reveal.in { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .althos-home .reveal { opacity: 1 !important; transform: none !important; transition: none; }
  .althos-home .aurora span, .althos-home .grain, .althos-home .ai-glow, .althos-home .ai-scan, .althos-home .marquee-track, .althos-home .plan.popular::before { animation: none !important; }
  .althos-home .browser { transition: none !important; }
}

/* Lightbox (zoom ao clicar nas telas) */
.althos-home .ah-lightbox { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 4vh 4vw; background: rgba(17,20,28,0.72); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); cursor: zoom-out; animation: ah-lb-fade 0.22s var(--ease); }
@keyframes ah-lb-fade { from { opacity: 0; } to { opacity: 1; } }
.althos-home .ah-lightbox img { max-width: 100%; max-height: 92vh; width: auto; height: auto; border-radius: 14px; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 50px 120px -30px rgba(0,0,0,0.6); animation: ah-lb-pop 0.26s var(--ease); }
@keyframes ah-lb-pop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.althos-home .ah-lightbox .ah-lb-close { position: absolute; top: 18px; right: 22px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.12); color: #fff; font-size: 22px; line-height: 1; display: grid; place-items: center; cursor: pointer; transition: background 0.2s var(--ease), transform 0.2s var(--ease); }
.althos-home .ah-lightbox .ah-lb-close:hover { background: rgba(255,255,255,0.22); transform: scale(1.06); }
@media (prefers-reduced-motion: reduce) {
  .althos-home .ah-lightbox, .althos-home .ah-lightbox img { animation: none; }
}

/* ============================================================
   MOBILE GPU RELIEF — previne crash de renderer (OOM/GPU)
   no celular. Desliga só as camadas DECORATIVAS mais caras
   (aurora/grain/glows) em telas pequenas / touch.
   ============================================================ */
@media (max-width: 640px), (hover: none) and (pointer: coarse) {
  .althos-home .aurora,
  .althos-home .grain,
  .althos-home .final .aurora-strong,
  .althos-home .mock-glow,
  .althos-home .feat-frame .glow,
  .althos-home .ai .ai-glow,
  .althos-home .ai-mock .glow { display: none !important; }

  .althos-home .ai-scan { animation: none !important; }
  .althos-home .ai-typingbar { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  .althos-home .browser { will-change: auto; transform: none !important; }
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

  /* --- Telas/screenshots: imagem INTEIRA (contain), nada cortado. --- */
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

  /* --- Comparativo: tabela compacta + garantias 2 a 2 --- */
  .althos-home .compare { padding: 52px 14px 56px; }
  .althos-home .compare-head { margin-bottom: 28px; }
  .althos-home .compare-head h2 { font-size: clamp(24px, 7vw, 34px); }
  .althos-home .compare-head p { font-size: 14.5px; margin-top: 14px; }
  .althos-home .cmp-row { grid-template-columns: minmax(0,1.5fr) 1fr 1fr 1fr; }
  .althos-home .cmp-header .cmp-feat, .althos-home .cmp-header .cmp-col { font-size: 11.5px; padding-top: 12px; padding-bottom: 12px; }
  .althos-home .cmp-feat { padding: 11px 11px; font-size: 12px; line-height: 1.3; }
  .althos-home .cmp-col { padding: 11px 4px; min-height: 48px; }
  .althos-home .cmp-yes svg { width: 18px; height: 18px; }
  .althos-home .cmp-no svg { width: 16px; height: 16px; }
  .althos-home .cmp-partial { font-size: 10px; line-height: 1.2; }
  .althos-home .guarantees { gap: 10px; margin-top: 18px; }
  .althos-home .guarantee { padding: 16px 14px; border-radius: 13px; }
  .althos-home .g-tick { width: 32px; height: 32px; margin-bottom: 10px; }
  .althos-home .g-tick svg { width: 16px; height: 16px; }
  .althos-home .guarantee h4 { font-size: 14.5px; }
  .althos-home .guarantee p { font-size: 12.5px; }

  /* --- Features: imagem fixa no topo + accordion compacto. --- */
  .althos-home .features { padding: 48px 16px 56px; }
  .althos-home .features-head h2 { font-size: clamp(26px, 7.5vw, 34px); }
  .althos-home .features-grid { gap: 4px; margin-top: 20px; }
  .althos-home .feat-sticky { position: static; top: auto; height: auto; min-height: 0; margin-bottom: 16px; }
  .althos-home .feat-steps { border-top: 1px solid var(--line); }
  .althos-home .feat-step { min-height: 0; padding: 0; border-bottom: 1px solid var(--line); cursor: pointer; display: block; }
  .althos-home .feat-step .idx { display: none; }
  .althos-home .feat-step h3 { font-size: 16.5px; line-height: 1.3; color: var(--ink); margin: 0; padding: 15px 30px 15px 0; position: relative; }
  .althos-home .feat-step h3::after { content: "+"; position: absolute; right: 2px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; display: grid; place-items: center; font-size: 20px; font-weight: 300; line-height: 1; color: var(--accent); }
  .althos-home .feat-step.open h3::after { content: "\\2013"; }
  .althos-home .feat-step p { font-size: 14.5px; line-height: 1.55; margin: 0; max-width: none; max-height: 0; opacity: 0; overflow: hidden; padding: 0; transition: max-height 0.3s var(--ease), opacity 0.25s var(--ease), padding 0.3s var(--ease); }
  .althos-home .feat-step.open p { max-height: 320px; opacity: 1; padding: 0 0 14px; }
  .althos-home .feat-step .learn { margin: 0; max-height: 0; overflow: hidden; transition: max-height 0.3s var(--ease), opacity 0.25s var(--ease), margin 0.3s var(--ease); }
  .althos-home .feat-step.open .learn { max-height: 40px; opacity: 1; transform: none; margin: 0 0 16px; }

  /* --- AI block: 1 destaque + lista curta. --- */
  .althos-home .ai { padding: 48px 0 52px; }
  .althos-home .ai-inner { padding: 0 16px; }
  .althos-home .ai-head { margin-bottom: 28px; }
  .althos-home .ai-head h2 { font-size: clamp(28px, 8vw, 38px); }
  .althos-home .ai-head p { font-size: 15px; margin-top: 12px; }
  .althos-home .ai-grid { gap: 24px; }
  .althos-home .ai-list { gap: 8px; }
  .althos-home .ai-cap { padding: 11px 13px; gap: 11px; align-items: center; }
  .althos-home .ai-cap .tick { width: 26px; height: 26px; border-radius: 7px; }
  .althos-home .ai-cap .tick svg { width: 15px; height: 15px; }
  .althos-home .ai-cap .ctext h4 { font-size: 14px; margin: 0; }
  .althos-home .ai-cap .ctext span { display: none; }

  /* --- Segments bento: 2 cards por linha --- */
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
  .althos-home .seg-link { opacity: 1; transform: none; margin-top: 10px; font-size: 12px; }
  .althos-home .bento-card h3 { font-size: 16.5px; margin-bottom: 6px; }
  .althos-home .bento-card.lead h3 { font-size: 18px; }
  .althos-home .bento-card p,
  .althos-home .bento-card.lead p { font-size: 12.5px; line-height: 1.45; max-width: none; }

  /* --- Pricing --- */
  .althos-home .pricing { padding: 52px 16px 60px; }
  .althos-home .pricing-head { margin-bottom: 26px; }
  .althos-home .pricing-head h2 { font-size: clamp(26px, 7.5vw, 36px); }
  .althos-home .billing-toggle { margin-top: 22px; gap: 2px; padding: 4px; }
  .althos-home .billing-toggle button { font-size: 12.5px; padding: 7px 11px; }
  .althos-home .plans { display: flex; grid-template-columns: none; gap: 12px; margin: 28px -16px 0; padding: 16px 16px 10px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; align-items: stretch; }
  .althos-home .plans::-webkit-scrollbar { display: none; }
  .althos-home .plan { flex: 0 0 78%; max-width: 280px; padding: 18px 15px; border-radius: 14px; scroll-snap-align: start; }
  .althos-home .plan.popular { transform: none; }
  .althos-home .plan h3 { font-size: 16px; }
  .althos-home .plan .ptag { font-size: 13px; min-height: 0; margin-top: 4px; }
  .althos-home .plan .price { margin: 14px 0 3px; }
  .althos-home .plan .price .cur { font-size: 18px; }
  .althos-home .plan .price .val { font-size: 34px; }
  .althos-home .plan .price .per { font-size: 13px; }
  .althos-home .plan .annual-note { font-size: 12px; min-height: 0; }
  .althos-home .plan .pdesc { font-size: 13.5px; min-height: 0; margin-top: 14px; }
  .althos-home .plan .btn { margin-top: 16px; padding: 11px 14px; font-size: 14px; }
  .althos-home .plan ul { gap: 10px; margin-top: 18px; padding-top: 18px; }
  .althos-home .plan li { font-size: 13.5px; gap: 9px; line-height: 1.4; }
  .althos-home .plan li svg { width: 16px; height: 16px; }
  .althos-home .price-note { font-size: 12.5px; margin-top: 28px; }
  .althos-home .seals { margin-top: 32px; gap: 8px; }
  .althos-home .seal { font-size: 12px; padding: 8px 12px; }

  /* --- Final CTA --- */
  .althos-home .final { padding: 72px 20px 84px; }
  .althos-home .final h2 { font-size: clamp(32px, 9vw, 46px); }
  .althos-home .final p { font-size: 16px; margin-top: 18px; }
  .althos-home .final .btn { margin-top: 30px; font-size: 16px; padding: 15px 26px; }

  /* --- GEO / FAQ --- */
  .althos-home .geo { padding: 52px 16px 8px; }
  .althos-home .geo-head { margin-bottom: 24px; }
  .althos-home .geo-head h2 { font-size: clamp(24px, 7vw, 32px); }
  .althos-home .geo-intro { font-size: 14.5px; margin-bottom: 28px; }
  .althos-home .geo-grid { grid-template-columns: 1fr; gap: 12px; }
  .althos-home .geo-card { padding: 18px 16px; border-radius: 13px; }
  .althos-home .faq { padding: 40px 16px 60px; }
  .althos-home .faq-head { margin-bottom: 24px; }
  .althos-home .faq-head h2 { font-size: clamp(22px, 7vw, 28px); }
  .althos-home .faq-item { padding: 4px 16px; }
  .althos-home .faq-item summary { font-size: 14px; padding: 14px 0; }
}
`
