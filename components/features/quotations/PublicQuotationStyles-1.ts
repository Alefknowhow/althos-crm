/**
 * Public quotation view CSS (part 1/3 — base/tokens through lightbox).
 * Split out of PublicQuotationStyles.ts.
 */
export const CSS_1 = `
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
`
