/**
 * The public quotation view's CSS, as a template string injected via
 * <style>{CSS}</style> -- a straight port of the design handoff HTML.
 * Split out of PublicQuotationView.tsx (it's a single unbroken template
 * literal, so it can't be usefully split further).
 */

export function urlHref(u: string) { return /^https?:\/\//.test(u) ? u : `https://${u}` }
export function igHref(u: string) {
  const handle = u.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  return /^https?:\/\//.test(u) ? u : `https://instagram.com/${handle}`
}

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.alq{
  --navy:#222222; --navy-soft:#3f3f3f; --gold:#0f62fe; --gold-soft:#4589ff;
  --ivory:#f7f7f7; --paper:#FFFFFF; --ink:#222222; --muted:#6a6a6a;
  --line:#dddddd; --sea:#222222; --ok:#2f7d5b; --no:#c13515; --body:#3f3f3f;
  --shadow:rgba(0,0,0,.02) 0 0 0 1px,rgba(0,0,0,.04) 0 2px 6px,rgba(0,0,0,.1) 0 4px 8px;
  --radius:14px;
  background:var(--ivory); color:var(--ink);
  font-family:'Inter',-apple-system,system-ui,Roboto,'Helvetica Neue',sans-serif; line-height:1.5;
  -webkit-font-smoothing:antialiased; min-height:100vh;
}
.alq *{box-sizing:border-box}
.alq .wrap{max-width:860px;margin:0 auto;padding:0 20px}
.alq h1,.alq h2,.alq h3{font-family:'Inter',-apple-system,system-ui,sans-serif;font-weight:600;letter-spacing:0;margin:0}
.alq .eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:600}
@media(prefers-reduced-motion:no-preference){
  .alq .reveal{opacity:0;transform:translateY(14px);transition:opacity .7s ease,transform .7s ease}
  .alq .reveal.in{opacity:1;transform:none}
}

/* HERO */
.alq .hero{position:relative;min-height:78vh;display:flex;align-items:flex-end;
  background:linear-gradient(160deg,#222222 0%,#3f3f3f 55%,#4a4a4a 100%);overflow:hidden}
/* Desktop: a capa fica contida na largura do conteúdo, em 16:9 — antes ia
   de ponta a ponta da tela com altura em vh, o que forçava um recorte
   agressivo (e "distorcido" aos olhos) em telas largas. Mobile mantém o
   hero cheio, como já era. */
@media(min-width:561px){
  .alq .hero{max-width:860px;margin:24px auto 0;aspect-ratio:16/9;min-height:0;border-radius:var(--radius)}
}
.alq .hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.1s ease}
.alq .hero>img.loaded{opacity:1}
.alq .hero::after{content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,.05) 40%,rgba(0,0,0,.82) 100%)}
.alq .hero-inner{position:relative;z-index:2;color:#fff;padding:0 20px 56px;max-width:860px;margin:0 auto;width:100%}
/* Etiqueta com fundo escuro translúcido: o nome do cliente precisa de
   contraste garantido sobre qualquer foto de capa */
.alq .hero .eyebrow{display:inline-block;color:#fff;
  background:var(--gold);backdrop-filter:blur(8px);
  border:1px solid var(--gold);border-radius:999px;
  padding:7px 16px;text-shadow:none}
.alq .hero h1{color:#fff;font-size:clamp(30px,5vw,44px);font-weight:700;line-height:1.15;margin:14px 0 10px;max-width:15ch;
  text-shadow:0 2px 30px rgba(0,0,0,.25)}
.alq .hero h2{color:rgba(255,255,255,.86);font-style:normal;font-size:clamp(16px,2.4vw,20px);font-weight:500}
.alq .hero-meta{margin-top:14px;font-size:13px;letter-spacing:.02em;color:rgba(255,255,255,.75)}

.alq .countdown{position:absolute;z-index:3;top:20px;right:20px;
  background:rgba(255,255,255,.96);backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,.5);border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,.18);
  padding:14px 18px;text-align:center;color:#1a1a1a;min-width:132px}
.alq .countdown .cd-num{font-family:'Inter',sans-serif;font-size:38px;font-weight:700;line-height:1;color:var(--gold)}
.alq .countdown .cd-lbl{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.75;margin-top:4px;color:#1a1a1a}
.alq .countdown .cd-date{font-size:11px;opacity:.65;margin-top:6px;color:#1a1a1a}
@media(max-width:560px){.alq .countdown{top:14px;right:14px;padding:10px 14px;min-width:104px}.alq .countdown .cd-num{font-size:28px}}

/* 3 CARDS */
.alq .facts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:-40px auto 0;position:relative;z-index:4}
.alq .fact{background:var(--paper);border-radius:var(--radius);padding:22px 20px;box-shadow:var(--shadow);
  border-top:3px solid var(--gold)}
.alq .fact .ic{width:26px;height:26px;color:var(--sea);margin-bottom:10px}
.alq .fact .k{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:700}
/* valor em ink: máximo contraste contra a etiqueta rausch */
.alq .fact .v{font-family:'Inter',sans-serif;font-size:18px;margin-top:4px;line-height:1.2;color:var(--navy);font-weight:600}
.alq .fact .v small{display:block;font-family:'Inter';font-size:12.5px;color:var(--body);font-weight:400;margin-top:3px;letter-spacing:normal}
@media(max-width:640px){.alq .facts{gap:8px;margin-top:-28px}}

/* INTRO */
.alq .intro{background:var(--paper);border-radius:var(--radius);box-shadow:var(--shadow);
  padding:34px 34px 30px;margin-top:22px;border-left:4px solid var(--gold);position:relative}
.alq .intro p{margin:0 0 14px;font-size:16px;color:var(--body)}
.alq .intro p:last-of-type{margin-bottom:22px}
.alq .intro .sig{font-family:'Inter',sans-serif;font-style:normal;font-weight:600;color:var(--navy);font-size:15px}
.alq .intro .sig span{display:block;font-family:'Inter';font-style:normal;font-weight:400;font-size:12.5px;color:var(--muted);margin-top:2px}
@media(max-width:560px){.alq .intro{padding:26px 22px}}

/* BLOCOS RETRÁTEIS */
.alq .block{background:var(--paper);border-radius:var(--radius);box-shadow:var(--shadow);
  margin-top:16px;overflow:hidden}
.alq .block-head{display:flex;align-items:center;gap:14px;width:100%;
  padding:22px 26px;background:none;border:0;cursor:pointer;text-align:left;color:var(--ink);
  font-family:inherit;font-size:inherit}
.alq .block-head:focus-visible{outline:2px solid var(--gold);outline-offset:-2px;border-radius:12px}
.alq .block-head .num{font-family:'Inter',sans-serif;font-weight:700;font-size:14px;color:var(--gold);width:26px;flex:none}
.alq .block-head .bt{flex:1}
.alq .block-head h3{font-size:18px;font-weight:600}
.alq .block-head .sub{font-size:12.5px;color:var(--muted);margin-top:2px}
.alq .chev{width:20px;height:20px;color:var(--muted);transition:transform .35s ease;flex:none}
.alq .block.open .chev{transform:rotate(180deg)}
.alq .block-body{max-height:0;overflow:hidden;transition:max-height .45s ease}
.alq .block-inner{padding:0 26px 26px}
@media(max-width:560px){.alq .block-head{padding:18px 20px}.alq .block-inner{padding:0 20px 22px}}

/* Hospedagem */
.alq .lodge+.lodge{margin-top:26px;padding-top:26px;border-top:1px solid var(--line)}
.alq .lodge .name{display:inline-flex;align-items:center;gap:7px;font-family:'Inter',sans-serif;font-weight:600;font-size:19px;
  color:var(--navy);text-decoration:none;cursor:pointer}
.alq .lodge .name.static{cursor:default}
.alq .lodge .name:not(.static):hover{color:var(--gold)}
.alq .lodge .name .link-ic{width:15px;height:15px;color:var(--gold);opacity:.9}
.alq .lodge .meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 14px}
.alq .pill{font-size:12.5px;padding:5px 12px;border-radius:999px;background:var(--surface-strong,#f2f2f2);color:var(--body);
  border:1px solid var(--line);font-weight:500}
.alq .pill.gold{background:rgba(15,98,254,.1);color:#0f62fe;border-color:rgba(15,98,254,.3)}
.alq .pill.stars-pill{color:#f1c21b;letter-spacing:1px;font-size:13px;padding:5px 10px}
.alq .lodge p{margin:0 0 14px;color:var(--body);font-size:15px}
.alq .gallery{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:repeat(2,90px);gap:8px}
.alq .gallery .g{border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#dfe6e3,#cdd8d6);position:relative;padding:0;border:0;cursor:zoom-in;display:block}
.alq .gallery .g:first-child{grid-row:1/3}
.alq .gallery .g img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .8s,transform .3s;position:relative;z-index:1}
.alq .gallery .g img.loaded{opacity:1}
.alq .gallery .g:hover img{transform:scale(1.04)}
.alq .gallery .g .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9fb0ac}
.alq .gallery .g .g-more{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;font-size:18px;font-weight:700}
@media(max-width:560px){.alq .gallery{grid-template-rows:repeat(2,70px)}}

/* Lightbox */
.alq .pp-lb{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:20px}
.alq .pp-lb-img{max-width:94vw;max-height:88vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.alq .pp-lb-close{position:absolute;top:16px;right:18px;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;border:0;font-size:26px;line-height:1;cursor:pointer}
.alq .pp-lb-close:hover{background:rgba(255,255,255,.26)}
.alq .pp-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer}
.alq .pp-lb-nav:hover{background:rgba(255,255,255,.26)}
.alq .pp-lb-nav.left{left:14px}.alq .pp-lb-nav.right{right:14px}
.alq .pp-lb-count{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.85);font-size:13px}
@media(max-width:560px){.alq .pp-lb-nav{width:40px;height:40px}}

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
