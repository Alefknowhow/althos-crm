import { CHECK, CROSS } from './AlthosHomeShared'

/* ----------------------------- Stats ----------------------------- */
export function Stats() {
  return (
    <section className="stats reveal" data-d="0" aria-label="Resultados">
      <div className="stats-inner">
        <div className="stat">
          <div className="stat-num" data-target="24" data-unit="h">0<span className="unit">h</span></div>
          <div className="stat-label">atendimento com IA, sem pausa</div>
        </div>
        <div className="stat">
          <div className="stat-num" data-target="100" data-unit="%">0<span className="unit">%</span></div>
          <div className="stat-label">dos leads com follow-up automático</div>
        </div>
        <div className="stat">
          <div className="stat-num" data-target="5" data-unit="min">0<span className="unit">min</span></div>
          <div className="stat-label">para colocar no ar</div>
        </div>
      </div>
    </section>
  )
}

/* Comparativo Althos × Kommo × HubSpot. `a/k/h`: true = incluído,
 * false = não tem, string = texto curto (ex.: "Pago à parte"). */
const CMP_ROWS: { feat: string; a: boolean | string; k: boolean | string; h: boolean | string }[] = [
  { feat: 'Atendente de IA 24h no WhatsApp', a: true, k: 'Pago à parte', h: 'Pago à parte' },
  { feat: 'Automações sem precisar programar', a: true, k: true, h: 'Plano avançado' },
  { feat: 'Feito para nichos brasileiros', a: true, k: false, h: false },
  { feat: 'Preço e cobrança em Real (R$)', a: true, k: false, h: false },
  { feat: 'Suporte humano em português', a: true, k: 'Limitado', h: 'Limitado' },
  { feat: 'Teste completo por 15 dias, sem cartão', a: true, k: 'Limitado', h: 'Limitado' },
  { feat: 'Pronto pra usar em minutos', a: true, k: 'Configuração longa', h: 'Implantação cara' },
  { feat: 'Sem fidelidade — cancele quando quiser', a: true, k: true, h: false },
]

const GUARANTEES = [
  { h: 'Sem fidelidade', p: 'Cancele quando quiser, direto pelo painel. Nada de multa ou letra miúda.' },
  { h: 'Comece sem cartão', p: 'Teste o app completo por 15 dias. Você só assina quando decidir continuar.' },
  { h: 'Suporte de gente', p: 'Atendimento humano em português, por quem conhece o seu tipo de negócio.' },
  { h: 'Seus dados protegidos', p: 'Hospedagem segura e conformidade com a LGPD. Seus contatos são só seus.' },
]

function cmpCell(v: boolean | string) {
  if (v === true) return <span className="cmp-yes">{CHECK}</span>
  if (v === false) return <span className="cmp-no">{CROSS}</span>
  return <span className="cmp-partial">{v}</span>
}

/* ----------------------------- Compare ----------------------------- */
export function Compare() {
  return (
    <section className="compare" aria-label="Comparativo">
      <div className="compare-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Por que a Althos</div>
        <h2 className="reveal" data-d="1">Mais do que planilha e WhatsApp solto — sem a complexidade das plataformas gringas</h2>
        <p className="reveal" data-d="2">
          Se hoje o seu &quot;sistema&quot; é uma planilha e o WhatsApp do celular, qualquer automação já é um
          salto. E se você já cogitou uma ferramenta gringa, sabe que são caras, complexas e não
          falam a língua do seu negócio. A Althos entrega IA, automações e WhatsApp prontos pra
          vender — feita para o Brasil.
        </p>
      </div>

      <div className="cmp-table reveal" data-d="0" role="table" aria-label="Althos comparado a Kommo e HubSpot">
        <div className="cmp-row cmp-header" role="row">
          <span className="cmp-feat" role="columnheader">Recurso</span>
          <span className="cmp-col cmp-althos" role="columnheader">Althos</span>
          <span className="cmp-col" role="columnheader">Kommo</span>
          <span className="cmp-col" role="columnheader">HubSpot</span>
        </div>
        {CMP_ROWS.map((r, i) => (
          <div className="cmp-row" role="row" key={i}>
            <span className="cmp-feat" role="cell">{r.feat}</span>
            <span className="cmp-col cmp-althos" role="cell">{cmpCell(r.a)}</span>
            <span className="cmp-col" role="cell">{cmpCell(r.k)}</span>
            <span className="cmp-col" role="cell">{cmpCell(r.h)}</span>
          </div>
        ))}
      </div>

      <div className="guarantees">
        {GUARANTEES.map((g, i) => (
          <article className="guarantee reveal spot" data-d={i} key={i}>
            <span className="g-tick">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <h4>{g.h}</h4>
            <p>{g.p}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
