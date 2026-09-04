/**
 * Public quotation view CSS (part 2/3 — aéreo/mapa/itinerário/investimento).
 * Split out of PublicQuotationStyles.ts.
 */
export const CSS_2 = `
/* Aéreo — layout em 3 linhas */
.alq .flight-wrap{padding:16px 0}
.alq .flight-wrap+.flight-wrap{border-top:1px solid var(--line)}
/* Linha 1: tipo · data · duração · classe */
.alq .fl-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-bottom:10px}
.alq .fl-leg{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);font-weight:700}
.alq .fl-meta{font-size:12.5px;color:var(--muted)}
.alq .fl-meta::before{content:"·";margin-right:10px;color:var(--line)}
.alq .fl-cabin{margin-left:auto}
/* Linha 2: rota + cia */
.alq .fl-mid{display:flex;align-items:center;gap:14px}
.alq .route{display:flex;align-items:flex-start;gap:10px;flex:1;flex-wrap:nowrap;min-width:0}
.alq .route .ap{text-align:center;flex:1 1 0;min-width:0}
.alq .route .ap .code{font-family:'Inter',sans-serif;font-weight:700;font-size:20px;color:var(--navy);line-height:1}
.alq .route .ap .city{font-size:11px;color:var(--muted);line-height:1.25;margin-top:2px;word-break:break-word}
.alq .route .path{flex:1 1 44px;min-width:44px;margin-top:11px;height:1px;background:linear-gradient(90deg,var(--gold),transparent 40%,var(--gold) 60%,transparent);position:relative}
.alq .route .path svg{position:absolute;top:-9px;left:50%;transform:translateX(-50%);width:18px;height:18px;color:var(--gold)}
.alq .fl-airline{font-size:13.5px;font-weight:600;color:var(--ink);white-space:nowrap;flex:none;align-self:flex-start;margin-top:4px}
/* Linha 3: bagagem + escala */
.alq .fl-bags{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:12px}
.alq .fl-bags .bag{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#5a5140}
.alq .fl-bags .bag svg{width:14px;height:14px;color:var(--gold);flex:none}
.alq .fl-stop{font-size:12px;color:var(--muted);width:100%}

/* Mapa */
.alq .alq-map{height:360px;border-radius:12px;overflow:hidden;z-index:0;border:1px solid var(--line);background:#eef0ec}
.alq .map-legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;font-size:12.5px;color:var(--muted)}
.alq .map-legend span{display:inline-flex;align-items:center;gap:6px}
.alq .dot{width:11px;height:11px;border-radius:50%;flex:none;display:inline-block}

/* Itinerário em HTML rico (respeita fontes/cores/imagens do editor) */
.alq .rich-body{font-size:15px;line-height:1.6;color:var(--body)}
.alq .rich-body h1{font-family:'Inter',sans-serif;font-weight:700;font-size:22px;color:var(--navy);margin:6px 0 10px}
.alq .rich-body h2{font-family:'Inter',sans-serif;font-weight:600;font-size:19px;color:var(--navy);margin:6px 0 8px}
.alq .rich-body h3{font-family:'Inter',sans-serif;font-weight:600;font-size:16px;color:var(--navy);margin:6px 0 6px}
.alq .rich-body p{margin:0 0 12px}
.alq .rich-body img{max-width:100%;height:auto;border-radius:12px;margin:10px 0}
.alq .rich-body.zoomable img{cursor:zoom-in}
.alq .rich-body ul,.alq .rich-body ol{margin:0 0 12px;padding-left:22px}
.alq .rich-body li{margin:4px 0}
.alq .rich-body a{color:var(--gold);text-decoration:underline}
.alq .rich-body hr{border:0;border-top:1px solid var(--line);margin:16px 0}

/* Itinerário */
.alq .timeline{position:relative;padding-left:26px}
.alq .timeline::before{content:"";position:absolute;left:6px;top:6px;bottom:6px;width:2px;background:var(--line)}
.alq .day{position:relative;padding-bottom:22px}
.alq .day:last-child{padding-bottom:0}
.alq .day::before{content:"";position:absolute;left:-26px;top:4px;width:14px;height:14px;border-radius:50%;
  background:var(--paper);border:3px solid var(--gold)}
.alq .day .dh{font-family:'Inter',sans-serif;font-weight:600;font-size:16px;color:var(--navy)}
.alq .day .dh span{font-family:'Inter';font-weight:700;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:2px}
.alq .day ul{margin:8px 0 0;padding-left:0;list-style:none}
.alq .day li{font-size:14.5px;color:var(--body);padding:3px 0}

/* Importante */
.alq .important p{margin:0 0 12px;font-size:15px;color:var(--body)}
.alq .important ul{margin:0;padding-left:20px}
.alq .important li{font-size:15px;color:var(--body);margin-bottom:7px}

/* Inclui */
.alq .incl{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.alq .incl h4{font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 12px;display:flex;align-items:center;gap:8px;font-family:'Inter';font-weight:600}
.alq .incl .col-ok h4{color:var(--ok)}
.alq .incl ul{list-style:none;margin:0;padding:0}
.alq .incl li{font-size:14.5px;padding:6px 0 6px 26px;position:relative;color:var(--body);border-bottom:1px solid var(--line)}
.alq .incl li:last-child{border-bottom:0}
.alq .incl li::before{position:absolute;left:0;top:6px;font-weight:700}
.alq .yes li::before{content:"✓";color:var(--ok)}
.alq .nope li::before{content:"✕";color:var(--no)}
@media(max-width:560px){.alq .incl{grid-template-columns:1fr;gap:8px}}

/* Investimento */
.alq .invest{background:linear-gradient(160deg,var(--navy),var(--navy-soft));color:#fff;border-radius:var(--radius);
  padding:38px 34px;margin-top:22px;box-shadow:0 20px 50px rgba(0,0,0,.22)}
.alq .invest .eyebrow{color:#fff}
.alq .invest h3{color:#fff;font-size:21px;font-weight:700;margin:8px 0 24px}
.alq .price-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:26px}
.alq .price-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:20px}
.alq .price-card.total{border-color:rgba(15,98,254,.55);background:rgba(15,98,254,.12)}
.alq .price-card .lbl{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.66)}
.alq .price-card .amt{font-family:'Inter',sans-serif;font-weight:700;font-size:30px;margin-top:6px;line-height:1}
.alq .price-card.total .amt{color:#fff}
.alq .price-card .note{font-size:12px;color:rgba(255,255,255,.6);margin-top:6px}
.alq .opt-note{font-size:13px;color:rgba(255,255,255,.75);margin-bottom:18px}
.alq .opt-grid{display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:26px}
.alq .opt-card{position:relative;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:22px 18px 18px}
.alq .opt-badge{position:absolute;top:-10px;left:16px;background:var(--gold);color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 10px;border-radius:999px}
.alq .opt-name{font-family:'Inter',sans-serif;font-weight:600;font-size:16px;color:#fff;margin-top:4px}
.alq .opt-room{font-size:12px;color:rgba(255,255,255,.6);margin-top:2px}
.alq .opt-prices{display:flex;gap:18px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.14)}
.alq .opt-prices .lbl{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.alq .opt-prices .amt{font-family:'Inter',sans-serif;font-weight:700;font-size:20px;color:#fff;margin-top:4px}
.alq .pay{display:flex;flex-wrap:wrap;gap:10px;border-top:1px solid rgba(255,255,255,.14);padding-top:20px}
.alq .pay .row{display:flex;align-items:center;gap:6px;padding:7px 14px;font-size:13px;color:rgba(255,255,255,.9);
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:999px}
.alq .pay .row span{color:rgba(255,255,255,.7)}
.alq .pay .row b{color:#fff;font-weight:600}
.alq .disclaimer{margin-top:20px;font-size:11.5px;color:rgba(255,255,255,.5);line-height:1.5}
@media(max-width:560px){.alq .invest{padding:28px 22px}.alq .price-grid{grid-template-columns:1fr}}
`
