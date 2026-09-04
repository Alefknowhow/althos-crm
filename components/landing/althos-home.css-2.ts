/**
 * CSS escopado da landing AlthosHome (parte 2/3 — features/soluções/nichos).
 * Split out of althos-home.css.ts.
 */
export const HOME_CSS_2 = `
/* Features sticky (legado — mantido só pra não quebrar refs antigas; a
   apresentação atual das soluções usa .solutions acima) */
.althos-home .features { position: relative; max-width: 1360px; margin: 0 auto; padding: 40px 40px 120px; }
.althos-home .features-head { max-width: 720px; margin: 0 auto 20px; text-align: center; }
.althos-home .features-head .eyebrow { margin: 0 auto 22px; }
.althos-home .features-head h2 { font-weight: 800; font-size: clamp(36px,4.4vw,60px); line-height: 1.02; letter-spacing: -0.02em; color: var(--ink); text-wrap: balance; }
.althos-home .features-grid { display: grid; grid-template-columns: 0.72fr 1.55fr; gap: 56px; align-items: start; margin-top: 30px; }
.althos-home .feat-steps { display: flex; flex-direction: column; }
.althos-home .feat-step { min-height: 78vh; display: flex; flex-direction: column; justify-content: center; padding: 20px 0; }
.althos-home .feat-step .idx { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; color: var(--ink-faint); text-transform: uppercase; margin-bottom: 18px; }
.althos-home .feat-step .idx .n { width: 26px; height: 26px; border-radius: 0; display: grid; place-items: center; border: 1px solid var(--line-strong); background: var(--surface); font-variant-numeric: tabular-nums; color: var(--ink-dim); font-size: 12.5px; transition: all 0.4s var(--ease); }
.althos-home .feat-step.active .idx .n { border-color: var(--accent); color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 4px 14px -4px var(--accent-glow); }
.althos-home .feat-step h3 { font-weight: 800; font-size: clamp(30px,3.4vw,46px); line-height: 1.05; letter-spacing: -0.02em; color: var(--ink-faint); transition: color 0.4s var(--ease); text-wrap: balance; }
.althos-home .feat-step.active h3 { color: var(--ink); }
.althos-home .feat-step p { margin-top: 18px; font-size: 18.5px; line-height: 1.6; color: var(--ink-faint); max-width: 30em; transition: color 0.4s var(--ease); }
.althos-home .feat-step.active p { color: var(--ink-dim); }
.althos-home .feat-step .learn { margin-top: 22px; display: inline-flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 600; color: var(--accent); text-decoration: none; opacity: 0; transform: translateY(6px); transition: opacity 0.4s var(--ease), transform 0.4s var(--ease), gap 0.25s var(--ease); width: fit-content; }
.althos-home .feat-step.active .learn { opacity: 1; transform: none; }
.althos-home .feat-step .learn:hover { gap: 12px; }
.althos-home .feat-sticky { position: sticky; top: 12vh; height: 76vh; min-height: 460px; display: flex; align-items: center; }
.althos-home .feat-frame { position: relative; width: 100%; border-radius: 0; overflow: hidden; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-float); }
.althos-home .feat-frame .glow { position: absolute; inset: -10% -6% -18% -6%; z-index: 0; background: radial-gradient(58% 52% at 60% 40%, var(--accent-glow), transparent 72%); filter: blur(46px); pointer-events: none; }
.althos-home .feat-frame-bar { position: relative; z-index: 1; display: flex; align-items: center; gap: 7px; padding: 12px 15px; border-bottom: 1px solid var(--line); background: var(--surface-2); }
.althos-home .feat-frame-bar i { width: 10px; height: 10px; border-radius: 50%; background: #525252; }
.althos-home .feat-shots { position: relative; z-index: 1; aspect-ratio: 1820 / 862; background: #202020; }
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
.althos-home .ai-cap { display: flex; align-items: flex-start; gap: 16px; padding: 20px 22px; border-radius: 0; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-sm); cursor: default; transition: border-color 0.3s var(--ease), background 0.3s var(--ease), transform 0.3s var(--ease), box-shadow 0.3s var(--ease); }
.althos-home .ai-cap:hover { border-color: rgba(15,98,254,0.35); background: linear-gradient(180deg, rgba(15,98,254,0.05), rgba(15,98,254,0.01)); transform: translateX(4px); box-shadow: var(--shadow-card); }
.althos-home .ai-cap .tick { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 0; display: grid; place-items: center; border: 1px solid var(--line-strong); background: var(--surface-2); color: var(--ink-dim); transition: all 0.3s var(--ease); }
.althos-home .ai-cap:hover .tick { border-color: var(--accent); color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 4px 14px -4px var(--accent-glow); }
.althos-home .ai-cap .tick svg { width: 18px; height: 18px; }
.althos-home .ai-cap .ctext h4 { font-size: 18.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 5px; }
.althos-home .ai-cap .ctext span { font-size: 15px; color: var(--ink-dim); line-height: 1.5; }
.althos-home .ai-mock { position: relative; }
.althos-home .ai-mock .glow { position: absolute; inset: -8% -4% -14% -4%; z-index: 0; background: radial-gradient(56% 50% at 55% 42%, var(--accent-glow), transparent 70%); filter: blur(44px); pointer-events: none; }
.althos-home .ai-frame { position: relative; z-index: 1; border-radius: 0; overflow: hidden; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-float); }
.althos-home .ai-frame-bar { display: flex; align-items: center; gap: 7px; padding: 12px 15px; border-bottom: 1px solid var(--line); background: var(--surface-2); }
.althos-home .ai-frame-bar i { width: 10px; height: 10px; border-radius: 50%; background: #525252; }
.althos-home .ai-frame-bar .tag { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--accent); }
.althos-home .ai-frame-bar .tag .pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent-glow); animation: ah-pulse 1.4s ease-in-out infinite; }
@keyframes ah-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
.althos-home .ai-shot { position: relative; background: #202020; }
.althos-home .ai-shot img { width: 100%; display: block; object-fit: contain; cursor: zoom-in; }
.althos-home .ai-scan { position: absolute; left: 0; right: 0; top: 0; height: 40%; background: linear-gradient(180deg, transparent, rgba(69,137,255,0.10) 70%, rgba(69,137,255,0.18)); border-bottom: 1px solid rgba(69,137,255,0.35); box-shadow: 0 6px 24px rgba(69,137,255,0.18); animation: ah-scan 3.4s var(--ease) infinite; pointer-events: none; }
@keyframes ah-scan { 0% { transform: translateY(-100%); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(250%); opacity: 0; } }
.althos-home .ai-typingbar { position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 0; background: rgba(38,38,38,0.9); backdrop-filter: blur(8px); border: 1px solid rgba(69,137,255,0.25); box-shadow: 0 8px 26px -10px rgba(17,20,28,0.25); }
.althos-home .ai-typingbar .spark { color: var(--accent); flex: 0 0 auto; }
.althos-home .ai-typingbar .txt { font-size: 13.5px; color: var(--ink-dim); }
.althos-home .ai-typingbar .txt b { color: var(--ink); font-weight: 600; }
.althos-home .ai-typingbar .caret { display: inline-block; width: 2px; height: 1.05em; vertical-align: text-bottom; background: var(--accent); margin-left: 1px; animation: ah-caret 1s steps(1) infinite; }
@keyframes ah-caret { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }
@media (max-width: 900px) {
  .althos-home .ai-grid { grid-template-columns: 1fr; gap: 40px; }
  .althos-home .ai-mock { order: -1; }
}

/* Segments — nichos em abas dentro de uma caixa estilo navegador */
.althos-home .seg { position: relative; max-width: 1180px; margin: 0 auto; padding: 96px 40px 110px; border-top: 1px solid var(--line); }
.althos-home .seg-head { max-width: 760px; margin: 0 auto 52px; text-align: center; }
.althos-home .seg-head .eyebrow { margin: 0 auto 22px; }
.althos-home .seg-head h2 { font-weight: 800; font-size: clamp(36px,4.6vw,62px); line-height: 1.02; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.althos-home .niche-browser { position: relative; border-radius: 0; overflow: hidden; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-float); }
.althos-home .niche-browser .sol-tabbar { padding: 0 6px; background: var(--surface-2); }
.althos-home .niche-panel { padding: 40px; display: flex; flex-direction: column; align-items: flex-start; }
.althos-home .niche-panel .seg-icon { margin-bottom: 18px; }
.althos-home .niche-panel-title { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.althos-home .niche-panel-title h3 { font-weight: 800; letter-spacing: -0.015em; font-size: clamp(24px,2.4vw,32px); color: var(--ink); }
.althos-home .niche-panel .seg-tag { margin-bottom: 0; }
.althos-home .niche-panel p { margin-top: 10px; font-size: 15.5px; line-height: 1.6; color: var(--ink-dim); max-width: 42em; }
.althos-home .niche-panel .sol-bullets { max-width: 34em; }
.althos-home .niche-panel .btn { margin-top: 26px; }
@media (max-width: 640px) {
  .althos-home .seg { padding: 52px 16px 56px; }
  .althos-home .seg-head { margin-bottom: 30px; }
  .althos-home .seg-head h2 { font-size: clamp(26px, 7.5vw, 36px); }
  .althos-home .niche-browser .sol-tab { padding: 11px 13px; font-size: 12.5px; }
  .althos-home .niche-panel { padding: 22px 18px; }
}

/* Onboarding — passos numerados (estilo Attio "no ar em minutos") */
.althos-home .onboard { position: relative; max-width: 1180px; margin: 0 auto; padding: 96px 40px 100px; border-top: 1px solid var(--line); }
.althos-home .onboard-head { max-width: 760px; margin: 0 auto 52px; text-align: center; }
.althos-home .onboard-head .eyebrow { margin: 0 auto 22px; }
.althos-home .onboard-head h2 { font-weight: 800; font-size: clamp(32px,4.2vw,56px); line-height: 1.04; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.althos-home .onboard-head p { margin-top: 20px; font-size: clamp(16px,1.2vw,18px); line-height: 1.6; color: var(--ink-dim); }
.althos-home .steps { display: grid; grid-template-columns: repeat(5,1fr); gap: 18px; counter-reset: ah-step; }
.althos-home .step { position: relative; display: flex; flex-direction: column; gap: 14px; padding: 26px 22px 24px; border-radius: 0; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-sm); transition: transform 0.35s var(--ease), box-shadow 0.35s var(--ease), border-color 0.35s var(--ease); }
.althos-home .step:hover { transform: translateY(-3px); box-shadow: var(--shadow-card); border-color: var(--line-strong); }
.althos-home .step-n { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 0; font-size: 15px; font-weight: 800; color: #fff; background: linear-gradient(180deg, var(--accent-bright), var(--accent-deep)); box-shadow: 0 6px 16px -6px var(--accent-glow); }
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
.althos-home .save-pill { display: block; width: fit-content; margin: 18px auto 0; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; letter-spacing: 0.005em; color: var(--accent-bright); background: rgba(15,98,254,0.10); border: 1px solid rgba(15,98,254,0.24); }
.althos-home .plans { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-top: 48px; align-items: start; }
.althos-home .plan { position: relative; border-radius: 0; padding: 28px 24px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; }
.althos-home .plan.popular { background: linear-gradient(180deg, rgba(15,98,254,0.05), var(--surface)); box-shadow: var(--shadow-card); transform: translateY(-10px); z-index: 1; }
.althos-home .plan.popular::before { content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1px; background: linear-gradient(120deg, transparent 20%, var(--accent-bright), #78a9ff, transparent 80%); background-size: 220% 100%; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: ah-shimmer 3.2s linear infinite; pointer-events: none; }
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
.althos-home .plan li.off { color: var(--ink-faint); text-decoration: line-through; text-decoration-color: rgba(244,244,244,0.3); }
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
.althos-home .final .aurora-strong .s1 { width: 60vw; height: 60vw; max-width: 760px; max-height: 760px; left: 50%; top: 46%; transform: translate(-50%,-50%); background: radial-gradient(circle at 50% 50%, rgba(69,137,255,0.22), transparent 60%); animation: ah-breathe 8s ease-in-out infinite; }
.althos-home .final .aurora-strong .s2 { width: 40vw; height: 40vw; left: 22%; top: 30%; background: radial-gradient(circle at 50% 50%, rgba(120,169,255,0.18), transparent 62%); animation: ah-drift1 30s var(--ease) infinite alternate; }
.althos-home .final .aurora-strong .s3 { width: 38vw; height: 38vw; right: 16%; bottom: 6%; background: radial-gradient(circle at 50% 50%, rgba(166,200,255,0.18), transparent 64%); animation: ah-drift2 34s var(--ease) infinite alternate; }
.althos-home .final .vignette { position: absolute; inset: 0; z-index: 1; pointer-events: none; background: radial-gradient(120% 100% at 50% 50%, transparent 42%, rgba(38,38,38,0.6) 74%, var(--surface-2) 100%); }
.althos-home .final-inner { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; }
.althos-home .final h2 { font-weight: 800; font-size: clamp(44px,6vw,86px); line-height: 1.04; letter-spacing: -0.03em; color: var(--ink); text-wrap: balance; }
.althos-home .final h2 em { font-style: italic; background: linear-gradient(100deg, var(--accent-bright), var(--accent-deep)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.althos-home .final p { margin: 24px auto 0; font-size: clamp(17px,1.5vw,20px); line-height: 1.5; color: var(--ink-dim); max-width: 30em; }
.althos-home .final .btn { margin-top: 40px; font-size: 17px; padding: 17px 32px; border-radius: 0; }
.althos-home .final .micro { margin-top: 18px; font-size: 14px; color: var(--ink-faint); font-weight: 500; display: inline-flex; align-items: center; gap: 8px; }
.althos-home .final .micro .check { color: var(--accent); }
`
