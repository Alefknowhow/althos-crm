'use client'

import { useEffect, useRef, useState } from 'react'
import { HOME_CSS } from './althos-home.css'

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
        <Proof />
        <Features onZoom={onZoom} />
        <AiBlock onZoom={onZoom} />
        <Segments />
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
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> CRM com IA e automações</div>
        <h1 className="headline reveal" data-d="1">Transforme mais <em>leads</em> em clientes</h1>
        <p className="subtitle reveal" data-d="2">
          O CRM brasileiro que atende, qualifica e converte sozinho — com inteligência artificial e
          automações sob medida para o seu nicho.
        </p>
        <div className="cta-row reveal" data-d="3">
          <a href="/signup" className="btn btn-solid">Testar grátis por 7 dias <span className="arrow">→</span></a>
          <a href="/como-funciona" className="btn btn-outline">Agendar diagnóstico</a>
        </div>
        <div className="microcopy reveal" data-d="4"><span className="check">✓</span> Sem cartão de crédito</div>
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
          <div className="stat-label">atendimento automático</div>
        </div>
        <div className="stat">
          <div className="stat-num" data-target="30" data-prefix="+" data-unit="%">0<span className="unit">%</span></div>
          <div className="stat-label">conversão média</div>
        </div>
        <div className="stat">
          <div className="stat-num" data-target="5" data-unit="min">0<span className="unit">min</span></div>
          <div className="stat-label">para configurar</div>
        </div>
      </div>
    </section>
  )
}

const STAR = (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 20.5l1.4-6.8L2.2 9l6.9-.7z" /></svg>
)

const TESTIMONIALS = [
  { quote: 'A IA responde os leads em segundos, a qualquer hora. Paramos de perder venda no fim de semana.', big: '+35%', rlabel: 'em vendas nos primeiros 60 dias', name: 'Marina Costa', role: 'Diretora · Clínica Vértice', initials: 'MC' },
  { quote: 'Montei toda a automação de captação num fim de tarde. O time comercial finalmente foca em fechar.', big: '3×', rlabel: 'mais leads qualificados por mês', name: 'Rafael Andrade', role: 'Sócio · Andrade Imóveis', initials: 'RA' },
  { quote: 'O atendimento no WhatsApp ficou instantâneo e com a nossa cara. O cliente nem percebe que é IA.', big: '−40%', rlabel: 'no tempo de resposta ao cliente', name: 'Juliana Reis', role: 'CEO · Reis Turismo', initials: 'JR' },
]

const MARQUEE = [
  { name: 'Nimbus' }, { name: 'Vértice' }, { name: 'Aurora' }, { name: 'Construta' },
  { name: 'Meridiano' }, { name: 'Altura' }, { name: 'Conexo' },
]

/* ----------------------------- Proof ----------------------------- */
function Proof() {
  const items = [...MARQUEE, ...MARQUEE]
  return (
    <section className="proof" aria-label="Prova social">
      <p className="proof-eyebrow reveal" data-d="0">Empresas que crescem com a gente</p>

      <div className="marquee reveal" data-d="1" aria-hidden="true">
        <div className="marquee-track">
          {items.map((l, i) => (
            <span className="logo-item" key={i}>
              <span className="glyph">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  <circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" />
                </svg>
              </span>
              <span className="lname">{l.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="tcards">
        {TESTIMONIALS.map((t, i) => (
          <article className="tcard reveal" data-d={i} key={i}>
            <div className="stars" aria-label="5 de 5 estrelas">{STAR}{STAR}{STAR}{STAR}{STAR}</div>
            <p className="tquote">{t.quote}</p>
            <div className="tresult">
              <span className="big">{t.big}</span>
              <span className="rlabel">{t.rlabel}</span>
            </div>
            <div className="tmeta">
              <span className="avatar">{t.initials}</span>
              <span className="who">
                <span className="name">{t.name}</span>
                <span className="role">{t.role}</span>
              </span>
            </div>
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
    <section className="ai" aria-label="Inteligência artificial">
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
  { lead: true, tag: 'Nicho-âncora', h: 'Agências de viagens', p: 'Cotações, roteiros e follow-ups de viagem automatizados — do primeiro "quanto custa?" ao embarque, sem perder o timing de venda.', icon: <><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" /><circle cx="12" cy="12" r="10" /></> },
  { lead: false, h: 'Imobiliárias', p: 'Captação de leads e agendamento de visitas no piloto automático.', icon: <><path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-6h6v6" /></> },
  { lead: false, h: 'Clínicas', p: 'Agendamentos, confirmações e retorno de pacientes sem fila no WhatsApp.', icon: <><path d="M12 3v18M3 12h18" /><rect x="4" y="4" width="16" height="16" rx="4" /></> },
  { lead: false, h: 'Lojas de veículos', p: 'Do test-drive ao financiamento, cada lead acompanhado até fechar.', icon: <><path d="M3 13l2-5h14l2 5M5 13h14v5H5z" /><circle cx="7.5" cy="18" r="1.6" /><circle cx="16.5" cy="18" r="1.6" /></> },
  { lead: false, h: 'Agências de tráfego', p: 'Leads de anúncios direto no funil, com ROI por campanha à vista.', icon: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></> },
  { lead: false, h: 'Pequenas empresas', p: 'Organize clientes e vendas num lugar só, sem complicação nem custo alto.', icon: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 4a3 3 0 010 6M22 20c0-2.5-1.5-4.7-3.7-5.6" /></> },
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
          <article className={`bento-card reveal spot${s.lead ? ' lead' : ''}`} data-d={i} key={i}>
            <span className="seg-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>{s.icon}</svg>
            </span>
            {s.tag && <span className="seg-tag">{s.tag}</span>}
            <h3>{s.h}</h3>
            {s.lead && <div className="spacer" />}
            <p>{s.p}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

type Plan = {
  name: string; tag: string; m: string; a: string; mNote: string; aNote: string;
  desc: string; cta: string; solid?: boolean; popular?: boolean; feats: [string, boolean][];
}

const PLANS: Plan[] = [
  {
    name: 'Free', tag: 'Para dar o primeiro passo', m: '0', a: '0',
    mNote: 'Gratuito para sempre · sem cartão', aNote: 'Gratuito para sempre · sem cartão',
    desc: 'Organize seus leads e o pipeline e comece a vender com método — sem pagar nada.',
    cta: 'Começar grátis',
    feats: [['Até 50 leads', true], ['Pipeline e oportunidades', true], ['Formulários de captação', true], ['WhatsApp e Instagram', false], ['Atendente de IA 24h', false], ['Automações de tarefas', false]],
  },
  {
    name: 'Starter', tag: 'Ideal para começar', m: '197,00', a: '162,00',
    mNote: 'cobrado mensalmente', aNote: 'cobrado anualmente',
    desc: 'Para pequenos negócios que querem organizar e profissionalizar o atendimento.',
    cta: 'Começar grátis',
    feats: [['Leads ilimitados', true], ['1 usuário', true], ['WhatsApp e Instagram', true], ['Atendente de IA 24h', false], ['Automações de tarefas', false], ['Fluxos avançados condicionais', false], ['Insights e previsões com IA', false], ['Integração com Meta Ads', false], ['E-mail marketing', false], ['Acesso à API', false], ['Gerente de conta dedicado', false]],
  },
  {
    name: 'Pro', tag: 'Para crescer', m: '297,00', a: '244,00',
    mNote: 'cobrado mensalmente', aNote: 'cobrado anualmente',
    desc: 'Para empresas que querem automatizar processos e aumentar as vendas.',
    cta: 'Começar grátis', solid: true, popular: true,
    feats: [['Leads ilimitados', true], ['5 usuários', true], ['WhatsApp e Instagram', true], ['Atendente de IA 24h', true], ['Automações de tarefas', true], ['Fluxos avançados condicionais', false], ['Insights e previsões com IA', false], ['Integração com Meta Ads', true], ['E-mail marketing', true], ['Acesso à API', false], ['Gerente de conta dedicado', false]],
  },
  {
    name: 'Business', tag: 'Para escalar sem limites', m: '397,00', a: '326,00',
    mNote: 'cobrado mensalmente', aNote: 'cobrado anualmente',
    desc: 'Para empresas que precisam de mais controle, dados e performance em escala.',
    cta: 'Começar grátis',
    feats: [['Leads ilimitados', true], ['Usuários ilimitados', true], ['WhatsApp e Instagram', true], ['Atendente de IA 24h', true], ['Automações de tarefas', true], ['Fluxos avançados condicionais', true], ['Insights e previsões com IA', true], ['Integração com Meta Ads', true], ['E-mail marketing', true], ['Acesso à API', true], ['Gerente de conta dedicado', true]],
  },
]

const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6L9 17l-5-5" /></svg>
const CROSS = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M18 6L6 18M6 6l12 12" /></svg>

/* ----------------------------- Pricing ----------------------------- */
function Pricing() {
  const [annual, setAnnual] = useState(false)
  return (
    <section className="pricing" aria-label="Planos e preços">
      <div className="pricing-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Planos</div>
        <h2 className="reveal" data-d="1">Preço que cabe em qualquer fase</h2>
        <div className="billing-toggle reveal" data-d="2" role="group" aria-label="Ciclo de cobrança">
          <button className={annual ? '' : 'active'} aria-pressed={!annual} onClick={() => setAnnual(false)}>Mensal</button>
          <button className={annual ? 'active' : ''} aria-pressed={annual} onClick={() => setAnnual(true)}>Anual</button>
        </div>
        <p className="save-pill reveal" data-d="3">Economize 18% no plano anual</p>
      </div>

      <div className="plans">
        {PLANS.map(p => (
          <article className={`plan reveal${p.popular ? ' popular spot' : ''}`} key={p.name}>
            {p.popular && <span className="plan-badge">★ Mais popular</span>}
            <h3>{p.name}</h3>
            <p className="ptag">{p.tag}</p>
            <div className="price">
              <span className="cur">R$</span>
              <span className="val">{annual ? p.a : p.m}</span>
              <span className="per">/mês</span>
            </div>
            <p className="annual-note">{annual ? p.aNote : p.mNote}</p>
            <p className="pdesc">{p.desc}</p>
            <a href="/signup" className={`btn ${p.solid ? 'btn-solid' : 'btn-outline'}`}>{p.cta}</a>
            <ul>
              {p.feats.map(([label, on], i) => (
                <li className={on ? '' : 'off'} key={i}>{on ? CHECK : CROSS} {label}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="price-note reveal" data-d="0">
        Comece no <b>Free</b>, sem cartão. Nos planos pagos, os <b>7 dias de teste grátis</b> pedem uma
        forma de pagamento (Pix ou cartão) para iniciar. No anual, pague à vista no Pix ou parcele no
        cartão de crédito. <b>Sem fidelidade</b> — cancele quando quiser.
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

    /* features sticky scroll */
    {
      const steps = Array.from(root.querySelectorAll<HTMLElement>('.feat-step'))
      const shots = Array.from(root.querySelectorAll<HTMLImageElement>('#featShots img'))
      if (steps.length && shots.length) {
        const activate = (shot: string | null) => {
          steps.forEach(s => s.classList.toggle('active', s.getAttribute('data-shot') === shot))
          shots.forEach(img => img.classList.toggle('active', img.getAttribute('data-shot') === shot))
        }
        activate(steps[0].getAttribute('data-shot'))
        const io = new IntersectionObserver((entries) => {
          entries.forEach(e => { if (e.isIntersecting) activate((e.target as HTMLElement).getAttribute('data-shot')) })
        }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 })
        steps.forEach(s => io.observe(s))
        cleanups.push(() => io.disconnect())
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
