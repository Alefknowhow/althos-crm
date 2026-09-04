/**
 * Public quotation view CSS (part 3/3 — fechamento/rodapé/modal/mobile/print).
 * Split out of PublicQuotationStyles.ts.
 */
export const CSS_3 = `
/* Fechamento + CTA */
.alq .closing{text-align:center;padding:48px 20px 8px;max-width:640px;margin:0 auto}
.alq .closing h3{font-size:22px;font-weight:700;color:var(--navy);margin-bottom:14px}
.alq .closing p{font-size:16px;color:var(--body);margin:0 auto 26px;max-width:56ch}
.alq .closing-rich h1,.alq .closing-rich h2,.alq .closing-rich h3{font-size:22px;font-weight:700;color:var(--navy);margin-bottom:14px}
.alq .closing-rich p{font-size:16px;color:var(--body);margin:0 auto 26px;max-width:56ch}
.alq .cta-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.alq .btn{display:inline-flex;align-items:center;gap:9px;padding:14px 24px;border-radius:999px;font-weight:500;
  font-size:16px;text-decoration:none;transition:transform .18s ease,box-shadow .18s ease;cursor:pointer;border:0}
.alq .btn:hover{transform:translateY(-2px)}
.alq .btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.alq .btn svg{width:19px;height:19px}
.alq .btn-primary{background:#25D366;color:#0a3d22;box-shadow:0 8px 24px rgba(37,211,102,.32)}
.alq .btn-ghost{background:transparent;color:var(--navy);border:1.5px solid var(--navy)}
.alq .btn-ghost:hover{background:var(--navy);color:#fff}

/* Assinatura — destaque abaixo do fechamento, cores escolhidas no editor */
.alq .signature{display:flex;align-items:center;gap:16px;max-width:640px;margin:32px auto 0;padding:20px 24px;border-radius:16px}
.alq .signature-photo{width:56px;height:56px;border-radius:999px;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.35)}
.alq .signature-text{min-width:0}
.alq .signature-name{font-family:'Inter',sans-serif;font-weight:700;font-size:15px}
.alq .signature-message{font-size:13.5px;opacity:.92;margin-top:3px;line-height:1.4}
@media(max-width:560px){.alq .signature{flex-direction:column;text-align:center;margin:24px 16px 0}}

/* Rodapé */
.alq footer{background:var(--navy);color:rgba(255,255,255,.72);margin-top:56px;padding:44px 20px 34px}
.alq .foot{max-width:860px;margin:0 auto;text-align:center}
.alq .foot .social{font-size:14px;margin-bottom:24px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
.alq .foot .social a{color:#fff;display:inline-flex;transition:color .2s}
.alq .foot .social a:hover{color:var(--gold-soft)}
.alq .foot .social svg{width:22px;height:22px}
.alq .foot-sep{height:1px;background:rgba(255,255,255,.12);margin:24px 0}
.alq .foot .logo{font-family:'Inter',sans-serif;font-weight:600;font-size:20px;color:#fff;letter-spacing:0}
.alq .foot-logo-img{max-height:88px;width:auto;margin:0 auto;display:block;opacity:0;transition:opacity .6s}
.alq .foot-logo-img.loaded{opacity:1}
.alq .foot .legal{font-size:12.5px;margin-top:12px;line-height:1.8}
.alq .foot .legal a{color:rgba(255,255,255,.8);text-decoration:underline;text-underline-offset:3px}
.alq .foot .rights{font-size:11.5px;color:rgba(255,255,255,.45);margin-top:18px}

/* Modal hotel */
.alq .modal{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:20px}
.alq .modal.show{display:flex}
.alq .modal-bg{position:absolute;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px)}
.alq .modal-card{position:relative;background:var(--paper);border-radius:18px;max-width:640px;width:100%;
  max-height:88vh;overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,.4)}
.alq .modal-hero{height:190px;background:linear-gradient(135deg,#222222,#3f3f3f);position:relative}
.alq .modal-hero img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s}
.alq .modal-hero img.loaded{opacity:1}
.alq .modal-close{position:absolute;top:14px;right:14px;z-index:2;width:34px;height:34px;border-radius:50%;
  background:rgba(0,0,0,.4);color:#fff;border:0;cursor:pointer;font-size:18px}
.alq .modal-in{padding:24px 26px 28px}
.alq .modal-in .rating{display:inline-flex;align-items:center;gap:8px;background:var(--navy);color:#fff;
  padding:4px 10px;border-radius:8px;font-weight:700;font-size:14px}
.alq .modal-in .stars{color:var(--navy);font-size:14px;letter-spacing:2px}
.alq .ta-src{font-size:11px;color:var(--muted);margin-top:14px}
.alq .mini-gal{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:16px 0}
.alq .mini-gal div{aspect-ratio:1;border-radius:8px;background:linear-gradient(135deg,#dfe6e3,#cdd8d6);overflow:hidden}
.alq .mini-gal img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s}
.alq .mini-gal img.loaded{opacity:1}
.alq .lodge-desc{margin:16px 0}
.alq .lodge-desc-body{font-size:13px;line-height:1.6;color:var(--body)}
.alq .lodge-desc-body p{margin:0 0 8px}
.alq .lodge-desc-body.clamped{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.alq .lodge-desc-toggle{margin-top:6px;background:none;border:0;padding:0;font-size:12.5px;font-weight:600;color:var(--gold);cursor:pointer}
.alq .lodge-desc-toggle:hover{text-decoration:underline}
.alq .mini-map{height:170px;border-radius:12px;overflow:hidden;margin-top:14px;border:1px solid var(--line);background:#eef0ec}

/* ─────── Mobile: letras menores, espaços mais justos ─────── */
@media(max-width:560px){
  .alq{line-height:1.5}
  .alq .wrap{padding:0 14px}
  /* hero mais baixo e títulos compactos */
  .alq .hero{min-height:62vh}
  .alq .hero-inner{padding:0 14px 32px}
  .alq .hero h1{font-size:clamp(26px,7.5vw,34px);margin:10px 0 8px}
  .alq .hero h2{font-size:15px}
  .alq .hero .eyebrow{font-size:10.5px;letter-spacing:.14em;padding:5px 12px}
  .alq .hero-meta{margin-top:9px;font-size:12px}
  /* cards compactos: os 3 lado a lado (ícone em cima, texto embaixo) —
     fonte bem reduzida pra caber sem quebrar a linha. */
  .alq .facts{margin-top:-22px;gap:6px}
  .alq .fact{padding:10px 6px;border-top-width:2px;text-align:center}
  .alq .fact .ic{width:16px;height:16px;margin:0 auto 6px}
  .alq .fact .k{font-size:8.5px;letter-spacing:.08em}
  .alq .fact .v{font-size:12.5px;margin-top:1px;line-height:1.25}
  .alq .fact .v small{display:none}
  /* intro */
  .alq .intro{padding:20px 16px;margin-top:16px}
  .alq .intro p{font-size:14.5px;margin:0 0 10px}
  .alq .intro .sig{font-size:13.5px}
  /* blocos */
  .alq .block{margin-top:12px}
  .alq .block-head{padding:15px 16px;gap:10px}
  .alq .block-head .num{width:20px;font-size:12.5px}
  .alq .block-head h3{font-size:16.5px}
  .alq .block-head .sub{font-size:11.5px}
  .alq .block-inner{padding:0 16px 18px}
  /* hospedagem */
  .alq .lodge .name{font-size:18px}
  .alq .lodge p{font-size:14px}
  .alq .pill{font-size:11.5px;padding:4px 10px}
  .alq .lodge+.lodge{margin-top:20px;padding-top:20px}
  /* aéreo */
  .alq .route .ap .code{font-size:19px}
  .alq .flight .det{font-size:12px}
  .alq .flight .det b{font-size:13px}
  /* itinerário / importante / inclui */
  .alq .day .dh{font-size:15.5px}
  .alq .day li{font-size:13.5px}
  .alq .important p,.alq .important li{font-size:14px}
  .alq .incl li{font-size:13.5px;padding-left:24px}
  /* investimento */
  .alq .invest h3{font-size:20px;margin-bottom:18px}
  .alq .price-card{padding:16px}
  .alq .price-card .amt{font-size:28px}
  .alq .pay .row{font-size:13.5px}
  /* fechamento */
  .alq .closing{padding:36px 16px 4px}
  .alq .closing h3,.alq .closing-rich h1,.alq .closing-rich h2,.alq .closing-rich h3{font-size:21px}
  .alq .closing p,.alq .closing-rich p{font-size:14.5px}
  .alq .btn{padding:13px 22px;font-size:14px}
}

/* Print */
@media print{
  .alq .block-body{max-height:none!important;overflow:visible!important}
  .alq .countdown,.alq .cta-row{display:none!important}
  .alq .hero{min-height:320px}
  .alq,.alq *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
`
