import { HOME_GEO_INTRO, HOME_GEO_BLOCKS, HOME_FAQ } from '@/lib/site/content'

const ONBOARD_STEPS = [
  { h: 'Crie sua conta grátis', p: 'Sem cartão e sem burocracia. Em segundos você já está dentro do Althos.' },
  { h: 'Conecte seu WhatsApp', p: 'Ligue o número do seu negócio e traga seus contatos para o funil.' },
  { h: 'Ensine a IA', p: 'Descreva seu negócio e suas regras; o atendente de IA aprende o seu tom de voz.' },
  { h: 'Monte seu funil', p: 'Etapas, automações e formulários prontos para captar e dar follow-up.' },
  { h: 'Comece a vender', p: 'A IA atende 24h, qualifica e agenda. Você acompanha tudo pelo painel.' },
] as const

/* ----------------------------- Onboarding ----------------------------- */
export function Onboard() {
  return (
    <section className="onboard" aria-label="Como começar">
      <div className="onboard-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Comece em minutos</div>
        <h2 className="reveal" data-d="1">No ar hoje, vendendo amanhã</h2>
        <p className="reveal" data-d="2">
          Sem implantação cara nem semanas de configuração. Você conecta, a IA aprende o seu
          negócio e o funil começa a girar — no mesmo dia.
        </p>
      </div>
      <ol className="steps">
        {ONBOARD_STEPS.map((s, i) => (
          <li className="step reveal" data-d={i} key={i}>
            <span className="step-n">{i + 1}</span>
            <h3>{s.h}</h3>
            <p>{s.p}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ----------------------------- GEO + FAQ ----------------------------- */
/* Blocos objetivos ("o que é", "para quem", diferenciais, casos de uso) e
 * FAQ geral sobre CRM — conteúdo pensado para citação direta por buscadores
 * com IA (Google AI Overview), sem tom de conversa. O schema FAQPage
 * correspondente é injetado no Server Component (app/(public)/page.tsx). */
export function GeoFaq() {
  return (
    <>
      <section className="geo" aria-label="Sobre a Althos CRM">
        <div className="geo-head">
          <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> O que é a Althos CRM</div>
          <h2 className="reveal" data-d="1">Um CRM brasileiro com inteligência artificial</h2>
        </div>
        <p className="geo-intro reveal" data-d="2">{HOME_GEO_INTRO}</p>
        <div className="geo-grid">
          {HOME_GEO_BLOCKS.map((b, i) => (
            <article className="geo-card reveal" data-d={i} key={b.title}>
              <h3>{b.title}</h3>
              <p>{b.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="faq" aria-label="Perguntas frequentes">
        <div className="faq-head">
          <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Dúvidas comuns</div>
          <h2 className="reveal" data-d="1">Perguntas frequentes sobre CRM</h2>
        </div>
        <div className="faq-list">
          {HOME_FAQ.map((f, i) => (
            <details className="faq-item reveal" data-d={i} key={f.question}>
              <summary>
                {f.question}
                <span className="plus" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
                </span>
              </summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  )
}

/* ----------------------------- Final CTA ----------------------------- */
export function FinalCta() {
  return (
    <section className="final" aria-label="Comece agora">
      <div className="aurora-strong" aria-hidden="true"><span className="s1" /><span className="s2" /><span className="s3" /></div>
      <div className="vignette" aria-hidden="true" />
      <div className="final-inner">
        <h2 className="reveal" data-d="0">Pronto para transformar seus <em>resultados</em>?</h2>
        <p className="reveal" data-d="1">Coloque a IA do Althos pra atender, qualificar e vender por você — hoje, em minutos.</p>
        <div className="reveal" data-d="2">
          <a href="/signup" className="btn btn-solid">Testar grátis por 15 dias <span className="arrow">→</span></a>
        </div>
        <div className="micro reveal" data-d="3"><span className="check">✓</span> Teste completo · sem cartão</div>
      </div>
    </section>
  )
}
