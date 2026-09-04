/**
 * CSS escopado da landing AlthosHome (parte 3/3 — GEO/FAQ/reveal animation).
 * Split out of althos-home.css.ts.
 */
export const HOME_CSS_3 = `
/* GEO / conteúdo enciclopédico (o que é, para quem, diferenciais) */
.althos-home .geo { position: relative; max-width: 1080px; margin: 0 auto; padding: 96px 40px 20px; border-top: 1px solid var(--line); }
.althos-home .geo-head { max-width: 760px; margin: 0 auto 32px; text-align: center; }
.althos-home .geo-head .eyebrow { margin: 0 auto 22px; }
.althos-home .geo-head h2 { font-weight: 800; font-size: clamp(32px,4.2vw,52px); line-height: 1.05; letter-spacing: -0.025em; color: var(--ink); text-wrap: balance; }
.althos-home .geo-intro { max-width: 720px; margin: 0 auto 40px; font-size: 16px; line-height: 1.7; color: var(--ink-dim); text-align: center; }
.althos-home .geo-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; }
.althos-home .geo-card { border: 1px solid var(--line); border-radius: 0; padding: 24px 22px; background: var(--surface); box-shadow: var(--shadow-sm); }
.althos-home .geo-card h3 { font-size: 16px; font-weight: 700; color: var(--ink); margin-bottom: 8px; letter-spacing: -0.005em; }
.althos-home .geo-card p { font-size: 14px; line-height: 1.65; color: var(--ink-dim); }

/* FAQ */
.althos-home .faq { position: relative; max-width: 820px; margin: 0 auto; padding: 60px 40px 110px; }
.althos-home .faq-head { text-align: center; margin-bottom: 36px; }
.althos-home .faq-head .eyebrow { margin: 0 auto 22px; }
.althos-home .faq-head h2 { font-weight: 800; font-size: clamp(30px,3.6vw,44px); line-height: 1.06; letter-spacing: -0.02em; color: var(--ink); text-wrap: balance; }
.althos-home .faq-list { display: flex; flex-direction: column; gap: 10px; }
.althos-home .faq-item { border: 1px solid var(--line); border-radius: 0; background: var(--surface); padding: 4px 20px; box-shadow: var(--shadow-sm); transition: border-color 0.25s var(--ease); }
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
.althos-home .ah-lightbox img { max-width: 100%; max-height: 92vh; width: auto; height: auto; border-radius: 0; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 50px 120px -30px rgba(0,0,0,0.6); animation: ah-lb-pop 0.26s var(--ease); }
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
  .althos-home .chip { font-size: 12px; padding: 6px 10px; border-radius: 999px; }
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
  .althos-home .guarantee { padding: 16px 14px; border-radius: 0; }
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
  .althos-home .ai-cap .tick { width: 26px; height: 26px; border-radius: 0; }
  .althos-home .ai-cap .tick svg { width: 15px; height: 15px; }
  .althos-home .ai-cap .ctext h4 { font-size: 14px; margin: 0; }
  .althos-home .ai-cap .ctext span { display: none; }

  /* --- Segments bento: 2 cards por linha --- */
  .althos-home .seg { padding: 52px 16px 56px; }
  .althos-home .seg-head { margin-bottom: 30px; }
  .althos-home .seg-head h2 { font-size: clamp(26px, 7.5vw, 36px); }
  .althos-home .bento { grid-template-columns: repeat(2,1fr); gap: 10px; }
  .althos-home .bento-card { padding: 16px 13px; min-height: 0; border-radius: 0; }
  .althos-home .bento-card.lead { grid-column: span 1; grid-row: span 1; }
  .althos-home .seg-icon,
  .althos-home .bento-card.lead .seg-icon { width: 36px; height: 36px; margin-bottom: 11px; border-radius: 0; }
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
  .althos-home .plan { flex: 0 0 78%; max-width: 280px; padding: 18px 15px; border-radius: 0; scroll-snap-align: start; }
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
  .althos-home .geo-card { padding: 18px 16px; border-radius: 0; }
  .althos-home .faq { padding: 40px 16px 60px; }
  .althos-home .faq-head { margin-bottom: 24px; }
  .althos-home .faq-head h2 { font-size: clamp(22px, 7vw, 28px); }
  .althos-home .faq-item { padding: 4px 16px; }
  .althos-home .faq-item summary { font-size: 14px; padding: 14px 0; }
}
`
