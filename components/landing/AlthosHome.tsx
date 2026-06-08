'use client'

import { useEffect, useRef, useState } from 'react'
import { HOME_CSS } from './althos-home.css'
import {
  PUBLIC_PLANS,
  getPlanPricing,
  ANNUAL_DISCOUNT_PCT,
  SEMESTRAL_DISCOUNT_PCT,
  type BillingCycle,
  type PlanConfig,
} from '@/lib/billing/plans'
import { PLAN_LIMITS, PLAN_META, type PlanId } from '@/lib/plans/config'

/* ---------------------------------------------------------------------------
 * AlthosHome — recreação da landing "tech premium dark" do handoff,
 * portada para o stack atual (React/Next + Tailwind shell). Todo o CSS é
 * injetado e escopado sob `.althos-home` (sem regras globais `*`/`body`),
 * então nada vaza para o header/footer (SiteShell) ou outras páginas.
 * O acento roxo do protótipo foi mapeado para o AZUL atual do Althos.
 * ------------------------------------------------------------------------- */

const SHOTS = {
  pipeline: '/home/screen-pipeline.png',
  dashboard: '/home/screen-dashboard.png',
  automacoes: '/home/screen-automacoes.png',
  insights: '/home/screen-insights.png',
  tasks: '/home/screen-tasks.png',
} as const

const HERO_TABS = [
  { key: 'pipeline', label: 'Pipeline', alt: 'Pipeline de vendas do Althos CRM' },
  { key: 'dashboard', label: 'Dashboard', alt: 'Dashboard do Althos CRM' },
  { key: 'automacoes', label: 'Automações', alt: 'Editor de automações do Althos CRM' },
  { key: 'insights', label: 'Insights IA', alt: 'Insights IA do Althos CRM' },
] as const

type ZoomImg = { src: string; alt: string } | null
type OnZoom = (src: string, alt: string) => void

export default function AlthosHome() {
  const [zoom, setZoom] = useState<ZoomImg>(null)
  const onZoom: OnZoom = (src, alt) => setZoom({ src, alt })

  return (
    <div className="althos-home">
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500;1,800&display=swap"
      />

      {/* Fundo global escopado (fica fixo atrás só enquanto a home está montada) */}
      <div className="aurora" aria-hidden="true">
        <span className="a1" />
        <span className="a2" />
        <span className="a3" />
      </div>
      <div className="bg-fade" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <div className="shell">
        <Hero onZoom={onZoom} />
        <Stats />
        <Features onZoom={onZoom} />
        <AiBlock onZoom={onZoom} />
        <Segments />
        <Compare />
        <Pricing />
        <FinalCta />
      </div>

      <Lightbox img={zoom} onClose={() => setZoom(null)} />
      <Behaviors />
    </div>
  )
}

/* ----------------------------- Lightbox ----------------------------- */
function Lightbox({ img, onClose }: { img: ZoomImg; onClose: () => void }) {
  useEffect(() => {
    if (!img) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [img, onClose])

  if (!img) return null
  return (
    <div className="ah-lightbox" role="dialog" aria-modal="true" aria-label={img.alt} onClick={onClose}>
      <button className="ah-lb-close" aria-label="Fechar" onClick={onClose}>×</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.src} alt={img.alt} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}

/* ----------------------------- Hero ----------------------------- */
function Hero({ onZoom }: { onZoom: OnZoom }) {
  const [tab, setTab] = useState<(typeof HERO_TABS)[number]['key']>('pipeline')

  return (
    <header className="hero">
      <div className="hero-copy">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Seu vendedor digital no WhatsApp</div>
        <h1 className="headline reveal" data-d="1">Seu próximo vendedor <em>não dorme</em> e nunca esquece o follow-up</h1>
        <p className="subtitle reveal" data-d="2">
          A Althos atende, qualifica e dá sequência em cada lead no WhatsApp — com IA e automações no
          piloto automático. Você acorda com a venda encaminhada, não com o lead esfriando.
        </p>
        <div className="cta-row reveal" data-d="3">
          <a href="/signup" className="btn btn-solid">Começar grátis <span className="arrow">→</span></a>
          <a href="#ai" className="btn btn-outline">Ver a IA atendendo</a>
        </div>
        <div className="microcopy reveal" data-d="4"><span className="check">✓</span> Grátis para sempre · sem cartão</div>
        <div className="chips reveal" data-d="5">
          <span className="chip"><span className="dot" /> Atendimento 24h com IA</span>
          <span className="chip"><span className="dot" /> Automações ilimitadas</span>
          <span className="chip"><span className="dot" /> WhatsApp nativo</span>
          <span className="chip"><span className="dot" /> Relatórios com IA</span>
        </div>
      </div>

      <div className="mock-wrap reveal" data-d="3">
        <div className="mock-glow" aria-hidden="true" />
        <div className="browser" id="browser">
          <div className="browser-bar">
            <span className="dots"><i /><i /><i /></span>
            <span className="url">
              <svg className="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              app.althoscrm.com.br
            </span>
          </div>
          <div className="tabs" role="tablist" aria-label="Telas do produto">
            {HERO_TABS.map(t => (
              <button
                key={t.key}
                className="tab"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="browser-screen">
            {HERO_TABS.map(t => (
              <div key={t.key} className={`panel${tab === t.key ? ' active' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SHOTS[t.key]} alt={t.alt} loading="eager" onClick={() => onZoom(SHOTS[t.key], t.alt)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}

/* ----------------------------- Stats ----------------------------- */
function Stats() {
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
  { feat: 'Plano gratuito de verdade', a: true, k: false, h: 'Limitado' },
  { feat: 'Pronto pra usar em minutos', a: true, k: 'Configuração longa', h: 'Implantação cara' },
  { feat: 'Sem fidelidade — cancele quando quiser', a: true, k: true, h: false },
]

const GUARANTEES = [
  { h: 'Sem fidelidade', p: 'Cancele quando quiser, direto pelo painel. Nada de multa ou letra miúda.' },
  { h: 'Comece sem cartão', p: 'O plano Free é grátis para sempre. Você só paga quando decidir crescer.' },
  { h: 'Suporte de gente', p: 'Atendimento humano em português, por quem conhece o seu tipo de negócio.' },
  { h: 'Seus dados protegidos', p: 'Hospedagem segura e conformidade com a LGPD. Seus contatos são só seus.' },
]

function cmpCell(v: boolean | string) {
  if (v === true) return <span className="cmp-yes">{CHECK}</span>
  if (v === false) return <span className="cmp-no">{CROSS}</span>
  return <span className="cmp-partial">{v}</span>
}

/* ----------------------------- Compare ----------------------------- */
function Compare() {
  return (
    <section className="compare" aria-label="Comparativo">
      <div className="compare-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Por que a Althos</div>
        <h2 className="reveal" data-d="1">O poder das grandes plataformas, sem a dor de cabeça</h2>
        <p className="reveal" data-d="2">
          Ferramentas gringas são caras, complexas e não falam a língua do seu negócio. A Althos
          entrega IA, automações e WhatsApp prontos pra vender — feita para o Brasil.
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

const FEAT_STEPS = [
  { shot: 'pipeline', n: '01', kicker: 'Funil de vendas', h: 'Funil de vendas visual', p: 'Arraste e solte negociações entre etapas, veja gargalos na hora e nunca mais perca um lead no meio do caminho.', link: 'Conhecer o funil →' },
  { shot: 'insights', n: '02', kicker: 'Inteligência artificial', h: 'Atendimento 24h com IA', p: 'A IA responde, qualifica e agenda sozinha — em segundos, a qualquer hora, com o tom de voz da sua empresa.', link: 'Ver a IA em ação →' },
  { shot: 'automacoes', n: '03', kicker: 'Automação', h: 'Automações sem código', p: 'Monte fluxos de captação, follow-up e pós-venda num editor visual. Sem programar, sem depender de ninguém.', link: 'Explorar automações →' },
  { shot: 'dashboard', n: '04', kicker: 'Dados', h: 'Relatórios e dashboards', p: 'Acompanhe conversão, receita e desempenho do time em painéis claros que se atualizam em tempo real.', link: 'Ver dashboards →' },
  { shot: 'tasks', n: '05', kicker: 'Produtividade', h: 'Tarefas e produtividade', p: 'Cada lead com a próxima ação definida. Lembretes, prazos e prioridades para o time nunca deixar dinheiro na mesa.', link: 'Organizar o time →' },
] as const

/* ----------------------------- Features ----------------------------- */
function Features({ onZoom }: { onZoom: OnZoom }) {
  return (
    <section className="features" aria-label="Funcionalidades">
      <div className="features-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Tudo num só lugar</div>
        <h2 className="reveal" data-d="1">Uma plataforma que vende enquanto você dorme</h2>
      </div>

      <div className="features-grid">
        <div className="feat-steps" id="featSteps">
          {FEAT_STEPS.map(s => (
            <article className="feat-step" data-shot={s.shot} key={s.shot}>
              <span className="idx"><span className="n">{s.n}</span> {s.kicker}</span>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
              <a className="learn" href="/funcionalidades">{s.link}</a>
            </article>
          ))}
        </div>

        <div className="feat-sticky">
          <div className="feat-frame">
            <div className="glow" aria-hidden="true" />
            <div className="feat-frame-bar" aria-hidden="true"><i /><i /><i /></div>
            <div className="feat-shots" id="featShots">
              {FEAT_STEPS.map((s, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={s.shot}
                  src={SHOTS[s.shot]}
                  data-shot={s.shot}
                  className={i === 0 ? 'active' : ''}
                  alt={s.h}
                  onClick={() => onZoom(SHOTS[s.shot], s.h)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const AI_CAPS = [
  { h: 'Responde e qualifica leads 24/7', s: 'Entende a intenção, faz as perguntas certas e separa quem está pronto pra comprar.' },
  { h: 'Cria follow-ups automáticos', s: 'Decide quando e como retomar cada conversa, sem ninguém lembrar de fazer isso.' },
  { h: 'Identifica seus leads mais quentes', s: 'Pontua cada oportunidade em tempo real para o time atacar o que importa primeiro.' },
  { h: 'Gera relatórios em português', s: 'Pergunte em linguagem natural e receba a análise pronta, com insights e recomendações.' },
]

/* ----------------------------- AI block ----------------------------- */
function AiBlock({ onZoom }: { onZoom: OnZoom }) {
  return (
    <section className="ai" id="ai" aria-label="Inteligência artificial">
      <div className="ai-glow" aria-hidden="true" />
      <canvas className="sparkles" id="aiSparkles" aria-hidden="true" />
      <div className="ai-inner">
        <div className="ai-head">
          <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Agente de IA</div>
          <h2 className="reveal" data-d="1">A IA que trabalha enquanto você dorme</h2>
          <p className="reveal" data-d="2">
            Não é mais um chatbot de respostas prontas. É um agente que raciocina sobre cada lead,
            decide o próximo passo e age sozinho — dentro do seu CRM.
          </p>
        </div>

        <div className="ai-grid">
          <div className="ai-list">
            {AI_CAPS.map((c, i) => (
              <div className="ai-cap reveal" data-d={i} key={i}>
                <span className="tick">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                <span className="ctext"><h4>{c.h}</h4><span>{c.s}</span></span>
              </div>
            ))}
          </div>

          <div className="ai-mock reveal" data-d="2">
            <div className="glow" aria-hidden="true" />
            <div className="ai-frame">
              <div className="ai-frame-bar">
                <i /><i /><i />
                <span className="tag"><span className="pulse" /> Gerando</span>
              </div>
              <div className="ai-shot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SHOTS.insights} alt="Insights gerados pela IA do Althos" onClick={() => onZoom(SHOTS.insights, 'Insights gerados pela IA do Althos')} />
                <div className="ai-scan" aria-hidden="true" />
                <div className="ai-typingbar">
                  <span className="spark">✦</span>
                  <span className="txt"><b>Althos IA</b> · <span id="aiTyping" /><span className="caret" /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const SEGMENTS = [
  { lead: true, tag: 'Nicho-âncora', h: 'Agências de viagens', p: 'Cotações, roteiros e follow-ups de viagem automatizados — do primeiro "quanto custa?" ao embarque, sem perder o timing de venda.', href: '/viagens', icon: <><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" /><circle cx="12" cy="12" r="10" /></> },
  { lead: false, h: 'Imobiliárias', p: 'Captação de leads e agendamento de visitas no piloto automático.', href: '/imobiliarias', icon: <><path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-6h6v6" /></> },
  { lead: false, h: 'Clínicas', p: 'Agendamentos, confirmações e retorno de pacientes sem fila no WhatsApp.', href: '/clinicas', icon: <><path d="M12 3v18M3 12h18" /><rect x="4" y="4" width="16" height="16" rx="4" /></> },
  { lead: false, h: 'Lojas de veículos', p: 'Do test-drive ao financiamento, cada lead acompanhado até fechar.', href: '/veiculos', icon: <><path d="M3 13l2-5h14l2 5M5 13h14v5H5z" /><circle cx="7.5" cy="18" r="1.6" /><circle cx="16.5" cy="18" r="1.6" /></> },
  { lead: false, h: 'Agências de tráfego', p: 'Leads de anúncios direto no funil, com ROI por campanha à vista.', href: '/trafego', icon: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></> },
  { lead: false, h: 'Pequenas empresas', p: 'Organize clientes e vendas num lugar só, sem complicação nem custo alto.', href: '/pequenas-empresas', icon: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4a3 3 0 010 6M22 20c0-2.5-1.5-4.7-3.7-5.6" /></> },
]

/* ----------------------------- Segments ----------------------------- */
function Segments() {
  return (
    <section className="seg" aria-label="Segmentos">
      <div className="seg-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Feito para o seu nicho</div>
        <h2 className="reveal" data-d="1">Um CRM que fala a língua do seu negócio</h2>
      </div>

      <div className="bento">
        {SEGMENTS.map((s, i) => (
          <a href={s.href} className={`bento-card reveal spot${s.lead ? ' lead' : ''}`} data-d={i} key={i}>
            <span className="seg-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>{s.icon}</svg>
            </span>
            {s.tag && <span className="seg-tag">{s.tag}</span>}
            <h3>{s.h}</h3>
            {s.lead && <div className="spacer" />}
            <p>{s.p}</p>
            <span className="seg-link">Ver solução <span aria-hidden="true">→</span></span>
          </a>
        ))}
      </div>
    </section>
  )
}

const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6L9 17l-5-5" /></svg>
const CROSS = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M18 6L6 18M6 6l12 12" /></svg>

const nBR = (v: number) => v.toLocaleString('pt-BR')

/**
 * Lista de funcionalidades por plano pago — espelha exatamente
 * components/site/PricingPlans.tsx (fonte: lib/plans/config). Starter/Pro/
 * Business têm as MESMAS funcionalidades; muda a QUANTIDADE de uso e dois
 * recursos premium (Insights IA + Exportar relatórios) ficam em Pro/Business.
 */
function planFeats(plan: PlanConfig): [string, boolean][] {
  const id = plan.key as PlanId
  const lim = PLAN_LIMITS[id] ?? PLAN_LIMITS.starter
  const meta = PLAN_META[id] ?? PLAN_META.starter
  const isPro = id === 'pro' || id === 'business'
  return [
    [lim.users === -1 ? 'Usuários ilimitados' : `${lim.users} usuário${lim.users > 1 ? 's' : ''}`, true],
    [lim.orgs === -1 ? 'Empresas ilimitadas' : `${lim.orgs} empresa${lim.orgs > 1 ? 's' : ''}`, true],
    ['Leads ilimitados', true],
    [lim.customers === -1 ? 'Clientes ilimitados' : `${nBR(lim.customers)} clientes`, true],
    [`${nBR(meta.aiCreditsMonthly)} créditos de IA/mês`, true],
    [lim.automations === -1 ? 'Automações ilimitadas' : `${lim.automations} automações`, true],
    ['WhatsApp, Instagram e Meta Ads', true],
    ['Atendente de IA 24h + score', true],
    ['Agendamentos online', true],
    ['Insights de vendas com IA', isPro],
    ['Exportar relatórios', isPro],
  ]
}

const FREE_FEATS: [string, boolean][] = [
  ['Até 100 leads', true],
  ['Pipeline e oportunidades', true],
  ['1 formulário de captação', true],
  ['WhatsApp e Instagram', false],
  ['Atendente de IA 24h', false],
  ['Automações de tarefas', false],
]

/* ----------------------------- Pricing ----------------------------- */
function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>('annual')
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <section className="pricing" aria-label="Planos e preços">
      <div className="pricing-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Planos</div>
        <h2 className="reveal" data-d="1">Preço que cabe em qualquer fase</h2>
        <div className="billing-toggle reveal" data-d="2" role="group" aria-label="Ciclo de cobrança">
          <button className={cycle === 'monthly' ? 'active' : ''} aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>Mensal</button>
          <button className={cycle === 'semestral' ? 'active' : ''} aria-pressed={cycle === 'semestral'} onClick={() => setCycle('semestral')}>Semestral</button>
          <button className={cycle === 'annual' ? 'active' : ''} aria-pressed={cycle === 'annual'} onClick={() => setCycle('annual')}>Anual</button>
        </div>
        <p className="save-pill reveal" data-d="3">
          {cycle === 'monthly'
            ? `Economize até ${ANNUAL_DISCOUNT_PCT}% nos planos anuais`
            : cycle === 'annual'
              ? `Economize ${ANNUAL_DISCOUNT_PCT}% no plano anual`
              : `Economize ${SEMESTRAL_DISCOUNT_PCT}% no plano semestral`}
        </p>
      </div>

      <div className="plans">
        {/* Free — não entra no checkout, é o ponto de partida grátis */}
        <article className="plan reveal">
          <h3>Free</h3>
          <p className="ptag">Para dar o primeiro passo</p>
          <div className="price">
            <span className="cur">R$</span>
            <span className="val">0</span>
            <span className="per">/mês</span>
          </div>
          <p className="annual-note">Gratuito para sempre · sem cartão</p>
          <p className="pdesc">Organize seus leads e o pipeline e comece a vender com método — sem pagar nada.</p>
          <a href="/signup" className="btn btn-outline">Começar grátis</a>
          <ul>
            {FREE_FEATS.map(([label, on], i) => (
              <li className={on ? '' : 'off'} key={i}>{on ? CHECK : CROSS} {label}</li>
            ))}
          </ul>
        </article>

        {PUBLIC_PLANS.map(plan => {
          const pricing = getPlanPricing(plan, cycle)
          const popular = plan.key === 'pro'
          return (
            <article className={`plan reveal${popular ? ' popular spot' : ''}`} key={plan.key}>
              {popular && <span className="plan-badge">★ Mais popular</span>}
              <h3>{plan.label}</h3>
              <p className="ptag">{plan.tagline}</p>
              <div className="price">
                <span className="cur">R$</span>
                <span className="val">{fmt(pricing.perMonthCents)}</span>
                <span className="per">/mês</span>
              </div>
              <p className="annual-note">
                {cycle === 'monthly'
                  ? 'cobrado mensalmente'
                  : cycle === 'annual'
                    ? `${pricing.totalLabel} por ano · economize ${pricing.savedLabel}`
                    : `${pricing.totalLabel} a cada 6 meses · economize ${pricing.savedLabel}`}
              </p>
              <p className="pdesc">{plan.description}</p>
              <a href="/signup" className={`btn ${popular ? 'btn-solid' : 'btn-outline'}`}>Começar grátis</a>
              <ul>
                {planFeats(plan).map(([label, on], i) => (
                  <li className={on ? '' : 'off'} key={i}>{on ? CHECK : CROSS} {label}</li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      <p className="price-note reveal" data-d="0">
        Comece no <b>Free</b>, sem cartão. Nos planos pagos, os <b>7 dias de teste grátis</b> pedem uma
        forma de pagamento (Pix ou cartão) para iniciar. No semestral e no anual, pague à vista no Pix ou
        parcele no cartão de crédito. <b>Sem fidelidade</b> — cancele quando quiser.
      </p>

      <div className="seals reveal" data-d="0">
        <span className="seal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 6L9 17l-5-5" /></svg> Cancelamento fácil</span>
        <span className="seal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg> Sem fidelidade</span>
        <span className="seal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg> Ambiente seguro</span>
        <span className="seal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg> Suporte humanizado</span>
      </div>
    </section>
  )
}

/* ----------------------------- Final CTA ----------------------------- */
function FinalCta() {
  return (
    <section className="final" aria-label="Comece agora">
      <div className="aurora-strong" aria-hidden="true"><span className="s1" /><span className="s2" /><span className="s3" /></div>
      <div className="vignette" aria-hidden="true" />
      <div className="final-inner">
        <h2 className="reveal" data-d="0">Pronto para transformar seus <em>resultados</em>?</h2>
        <p className="reveal" data-d="1">Coloque a IA do Althos pra atender, qualificar e vender por você — hoje, em minutos.</p>
        <div className="reveal" data-d="2">
          <a href="/signup" className="btn btn-solid">Testar grátis por 7 dias <span className="arrow">→</span></a>
        </div>
        <div className="micro reveal" data-d="3"><span className="check">✓</span> Plano Free grátis · sem cartão</div>
      </div>
    </section>
  )
}

/* ----------------------------- Behaviors (JS portado) ----------------------------- */
function Behaviors() {
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = document.querySelector('.althos-home')
    if (!root) return
    const cleanups: Array<() => void> = []

    /* reveal on scroll-in (stagger via data-d) */
    {
      const items = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
      if (reduce) {
        items.forEach(el => el.classList.add('in'))
      } else {
        const io = new IntersectionObserver((entries) => {
          entries.forEach(e => {
            if (e.isIntersecting) {
              const el = e.target as HTMLElement
              const d = parseInt(el.getAttribute('data-d') || '0', 10)
              el.style.transitionDelay = `${d * 90}ms`
              el.classList.add('in')
              io.unobserve(el)
            }
          })
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
        items.forEach(el => io.observe(el))
        cleanups.push(() => io.disconnect())
      }
    }

    /* stats count-up */
    {
      const nums = Array.from(root.querySelectorAll<HTMLElement>('.stat-num'))
      const render = (el: HTMLElement, val: number) => {
        const prefix = el.getAttribute('data-prefix') || ''
        const unit = el.getAttribute('data-unit') || ''
        el.innerHTML = `${prefix}${val}<span class="unit">${unit}</span>`
      }
      const run = (el: HTMLElement) => {
        const target = parseInt(el.getAttribute('data-target') || '0', 10)
        if (reduce) { render(el, target); return }
        const dur = 1500
        let start: number | null = null
        const ease = (t: number) => 1 - Math.pow(1 - t, 3)
        const step = (ts: number) => {
          if (start === null) start = ts
          const p = Math.min((ts - start) / dur, 1)
          render(el, Math.round(ease(p) * target))
          if (p < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { run(e.target as HTMLElement); io.unobserve(e.target) } })
      }, { threshold: 0.5 })
      nums.forEach(el => io.observe(el))
      cleanups.push(() => io.disconnect())
    }

    /* features — mobile: accordion (tap abre + troca imagem);
       desktop: sticky scroll-driven activation */
    {
      const steps = Array.from(root.querySelectorAll<HTMLElement>('.feat-step'))
      const shots = Array.from(root.querySelectorAll<HTMLImageElement>('#featShots img'))
      if (steps.length && shots.length) {
        const isMobile = window.matchMedia('(max-width: 640px)').matches
        const activate = (shot: string | null) => {
          steps.forEach(s => s.classList.toggle('active', s.getAttribute('data-shot') === shot))
          shots.forEach(img => img.classList.toggle('active', img.getAttribute('data-shot') === shot))
        }
        if (isMobile) {
          const setOpen = (idx: number) => {
            steps.forEach((s, i) => s.classList.toggle('open', i === idx))
            activate(steps[idx].getAttribute('data-shot'))
          }
          steps.forEach((s, i) => {
            const onClick = (e: Event) => {
              // deixa o link "saiba mais" navegar sem reabrir
              if ((e.target as HTMLElement).closest('.learn')) return
              setOpen(i)
            }
            s.addEventListener('click', onClick)
            cleanups.push(() => s.removeEventListener('click', onClick))
          })
          setOpen(0)
        } else {
          activate(steps[0].getAttribute('data-shot'))
          const io = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) activate((e.target as HTMLElement).getAttribute('data-shot')) })
          }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 })
          steps.forEach(s => io.observe(s))
          cleanups.push(() => io.disconnect())
        }
      }
    }

    /* cursor spotlight */
    if (!reduce) {
      const cards = Array.from(root.querySelectorAll<HTMLElement>('.spot'))
      cards.forEach(card => {
        const onMove = (e: MouseEvent) => {
          const r = card.getBoundingClientRect()
          card.style.setProperty('--mx', `${e.clientX - r.left}px`)
          card.style.setProperty('--my', `${e.clientY - r.top}px`)
        }
        card.addEventListener('mousemove', onMove)
        cleanups.push(() => card.removeEventListener('mousemove', onMove))
      })
    }

    /* 3D tilt on hero mockup */
    if (!reduce) {
      const wrap = root.querySelector<HTMLElement>('.mock-wrap')
      const card = root.querySelector<HTMLElement>('#browser')
      if (wrap && card) {
        let raf: number | null = null, tx = 0, ty = 0, cx = 0, cy = 0
        const MAX = 7
        const tick = () => {
          cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12
          card.style.transform = `rotateX(${cx.toFixed(2)}deg) rotateY(${cy.toFixed(2)}deg)`
          if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(tick)
          else raf = null
        }
        const onMove = (e: MouseEvent) => {
          const r = wrap.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width - 0.5
          const py = (e.clientY - r.top) / r.height - 0.5
          tx = -py * MAX; ty = px * MAX
          if (!raf) raf = requestAnimationFrame(tick)
        }
        const reset = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick) }
        window.addEventListener('mousemove', onMove, { passive: true })
        wrap.addEventListener('mouseleave', reset)
        cleanups.push(() => { window.removeEventListener('mousemove', onMove); wrap.removeEventListener('mouseleave', reset); if (raf) cancelAnimationFrame(raf) })
      }
    }

    /* AI typewriter */
    {
      const el = root.querySelector<HTMLElement>('#aiTyping')
      if (el) {
        const phrases = [
          'qualificando 3 novos leads…',
          'agendando follow-up para amanhã, 9h…',
          'lead quente detectado: prioridade alta…',
          'gerando relatório semanal de conversão…',
        ]
        if (reduce) {
          el.textContent = phrases[0]
        } else {
          let pi = 0, ci = 0, deleting = false, timer = 0
          const tick = () => {
            const p = phrases[pi]
            ci += deleting ? -1 : 1
            el.textContent = p.slice(0, ci)
            let delay = deleting ? 28 : 52
            if (!deleting && ci === p.length) { deleting = true; delay = 1500 }
            else if (deleting && ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; delay = 350 }
            timer = window.setTimeout(tick, delay)
          }
          tick()
          cleanups.push(() => clearTimeout(timer))
        }
      }
    }

    /* AI sparkles canvas */
    if (!reduce) {
      const canvas = root.querySelector<HTMLCanvasElement>('#aiSparkles')
      const section = canvas?.closest<HTMLElement>('.ai')
      const ctx = canvas?.getContext('2d')
      if (canvas && section && ctx) {
        let dots: Array<{ x: number; y: number; r: number; a: number; sp: number; vy: number }> = []
        let W = 0, H = 0, raf: number | null = null
        const resize = () => {
          const r = section.getBoundingClientRect()
          W = canvas.width = r.width; H = canvas.height = r.height
          const n = Math.min(70, Math.round((W * H) / 26000))
          dots = []
          for (let i = 0; i < n; i++) dots.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4, a: Math.random(), sp: Math.random() * 0.02 + 0.005, vy: -(Math.random() * 0.25 + 0.05) })
        }
        const draw = () => {
          ctx.clearRect(0, 0, W, H)
          for (const d of dots) {
            d.a += d.sp; d.y += d.vy
            if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W }
            const o = (Math.sin(d.a) * 0.5 + 0.5) * 0.7
            ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(96,165,250,${o.toFixed(3)})`
            ctx.fill()
          }
          raf = requestAnimationFrame(draw)
        }
        resize()
        window.addEventListener('resize', resize)
        const io = new IntersectionObserver((e) => {
          if (e[0].isIntersecting) { if (!raf) draw() }
          else if (raf) { cancelAnimationFrame(raf); raf = null }
        }, { threshold: 0 })
        io.observe(section)
        cleanups.push(() => { window.removeEventListener('resize', resize); io.disconnect(); if (raf) cancelAnimationFrame(raf) })
      }
    }

    return () => { cleanups.forEach(fn => fn()) }
  }, [])

  return null
}
