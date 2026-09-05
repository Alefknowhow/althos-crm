import Image from 'next/image'
import { useState } from 'react'
import { SHOTS, type OnZoom } from './AlthosHomeShared'

const FEAT_STEPS = [
  { shot: 'pipeline', tabLabel: 'Funil', kicker: 'Visão completa da negociação', h: 'Funil de vendas visual', p: 'Veja cada etapa, arraste com um clique e ataque os gargalos assim que aparecem — antes que virem lead perdido.', link: 'Conhecer o funil →',
    bullets: ['Arraste leads entre etapas com um clique', 'Alerta automático de negociação parada', 'Filtros por vendedor, etapa e período'] },
  { shot: 'insights', tabLabel: 'Atendimento IA', kicker: 'Resposta em segundos, não em horas', h: 'Atendimento 24h com IA', p: 'A IA já respondeu, entendeu o que o cliente quer e qualificou se vale a pena continuar — no seu tom de voz, sem parecer robô.', link: 'Ver a IA em ação →',
    bullets: ['Responde no seu tom, 24h por dia', 'Lê prints e PDFs enviados pelo cliente', 'Transfere pra um humano quando precisa'] },
  { shot: 'automacoes', tabLabel: 'Automação', kicker: 'Zero tarefa manual repetida', h: 'Automações sem código', p: 'Defina uma vez o que deve acontecer depois de cada ação. Captação, retomada e pós-venda rodando sozinhos, sem programar.', link: 'Explorar automações →',
    bullets: ['Follow-up automático, sem programar', 'Gatilhos por etapa do funil', 'Regras por WhatsApp, Instagram e e-mail'] },
  { shot: 'dashboard', tabLabel: 'Dados', kicker: 'Decisão com número, não achismo', h: 'Relatórios e dashboards', p: 'Veja conversão, receita e desempenho de cada vendedor em tempo real, sem montar planilha.', link: 'Ver dashboards →',
    bullets: ['Conversão por vendedor e por etapa', 'Fluxo de caixa e financeiro em tempo real', 'Relatórios em português, sem planilha'] },
  { shot: 'tasks', tabLabel: 'Produtividade', kicker: 'Nada fica só na cabeça de alguém', h: 'Tarefas e produtividade', p: 'Cada lead com a próxima ação, prazo e responsável definidos. Ninguém do time descobre depois que deixou dinheiro na mesa.', link: 'Organizar o time →',
    bullets: ['Tarefa automática por etapa do funil', 'Prazo e responsável sempre definidos', 'Nada esquecido na memória de alguém'] },
] as const

/* ----------------------------- Solutions (abas) ----------------------------- */
export function Solutions({ onZoom }: { onZoom: OnZoom }) {
  const [active, setActive] = useState(0)
  const step = FEAT_STEPS[active]

  return (
    <section className="solutions" aria-label="Soluções por área">
      <div className="solutions-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Como o Althos resolve</div>
        <h2 className="reveal" data-d="1">Funil, atendimento com IA, automações e dados — conectados num só lugar</h2>
        <p className="reveal" data-d="2">
          Do primeiro contato ao pós-venda, o Althos CRM tem uma solução pronta pra cada ponto
          onde uma venda costuma travar.
        </p>
      </div>

      <div className="sol-tabbar" role="tablist" aria-label="Áreas do Althos CRM">
        {FEAT_STEPS.map((s, i) => (
          <button
            key={s.shot}
            type="button"
            role="tab"
            aria-selected={active === i}
            className={`sol-tab${active === i ? ' active' : ''}`}
            onClick={() => setActive(i)}
          >
            {s.tabLabel}
          </button>
        ))}
      </div>

      <div className="sol-panel">
        <div className="sol-copy">
          <span className="kicker">{step.kicker}</span>
          <h3>{step.h}</h3>
          <p>{step.p}</p>
          <ul className="sol-bullets">
            {step.bullets.map(b => (
              <li key={b}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6L9 17l-5-5" /></svg>
                {b}
              </li>
            ))}
          </ul>
          <a className="btn btn-solid" href="/funcionalidades">{step.link}</a>
        </div>
        <div className="sol-media">
          <div className="sol-frame">
            <div className="sol-frame-bar" aria-hidden="true"><i /><i /><i /></div>
            <div className="sol-shot">
              <Image
                src={SHOTS[step.shot]}
                alt={step.h}
                fill
                sizes="(max-width: 900px) 100vw, 700px"
                loading="lazy"
                onClick={() => onZoom(SHOTS[step.shot], step.h)}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const AI_CAPS = [
  { h: 'Raciocina sobre a conversa inteira', s: 'Não é um fluxo fixo de respostas — a IA lê o histórico completo e decide o próximo passo, como um vendedor faria.' },
  { h: 'Aprende o tom da sua empresa', s: 'Você descreve como o seu negócio atende, e a IA responde nesse padrão, sem soar como um robô genérico.' },
  { h: 'Prioriza sozinho quem está pronto pra comprar', s: 'Pontua cada oportunidade em tempo real para o time atacar o que importa primeiro.' },
  { h: 'Analisa seus dados em português', s: 'Pergunte "como foi o mês?" e receba a resposta com números, tendência e recomendação, sem abrir planilha.' },
]

/* ----------------------------- AI block ----------------------------- */
export function AiBlock({ onZoom }: { onZoom: OnZoom }) {
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
                <Image
                  src={SHOTS.insights}
                  alt="Insights gerados pela IA do Althos"
                  width={1821}
                  height={864}
                  sizes="(max-width: 900px) 100vw, 640px"
                  loading="lazy"
                  onClick={() => onZoom(SHOTS.insights, 'Insights gerados pela IA do Althos')}
                />
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
  { slug: 'viagens', tag: 'Nicho-âncora', h: 'Agências de viagens', p: 'Cotações, contratos e financeiro de viagem num só lugar — do "quanto custa?" ao embarque, sem perder o timing de venda.', href: '/viagens',
    bullets: ['Cotação com IA no WhatsApp', 'Contrato editável + voucher automático', 'Financeiro e créditos de viagem'],
    icon: <><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" /><circle cx="12" cy="12" r="10" /></> },
  { slug: 'clinicas', h: 'Clínicas e consultórios', p: 'Agendamentos, confirmações e retorno de pacientes sem fila no WhatsApp.', href: '/clinicas',
    bullets: ['Agendamento 24h no WhatsApp', 'Confirmação automática, menos faltas', 'Lembrete de retorno do paciente'],
    icon: <><path d="M12 3v18M3 12h18" /><rect x="4" y="4" width="16" height="16" rx="4" /></> },
  { slug: 'imobiliarias', h: 'Imobiliárias', p: 'Captação de leads e agendamento de visitas no piloto automático.', href: '/imobiliarias',
    bullets: ['Captação de portais e anúncios', 'Agendamento de visitas automático', 'Funil organizado por corretor'],
    icon: <><path d="M3 21V9l9-6 9 6v12" /><path d="M9 21v-6h6v6" /></> },
  { slug: 'advocacia', tag: 'Em breve', h: 'Escritórios de advocacia', p: 'Processos, prazos e honorários organizados — sem planilha, sem prazo perdido.', href: '/advocacia',
    bullets: ['Agenda de prazos com alerta', 'Gestão de processos com checklist', 'Honorários e propostas'],
    icon: <><path d="M12 3v4M5 7l14 0M5 7l-3 8a4 4 0 008 0l-3-8M19 7l-3 8a4 4 0 008 0l-3-8M9 21h6" /></> },
  { slug: 'seguros', tag: 'Em breve', h: 'Corretoras de seguros', p: 'Apólices, renovações e comissões sob controle, do fechamento à renovação.', href: '/seguros',
    bullets: ['Painel de próximas renovações', 'Comissões conciliadas automaticamente', 'Acompanhamento de sinistro'],
    icon: <><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" /></> },
]

/* ----------------------------- Segments ----------------------------- */
export function Segments() {
  const [active, setActive] = useState(0)
  const seg = SEGMENTS[active]

  return (
    <section className="seg" aria-label="Segmentos">
      <div className="seg-head">
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Feito para o seu nicho</div>
        <h2 className="reveal" data-d="1">Seja qual for o seu segmento, temos uma solução pronta pra vender mais</h2>
      </div>

      <div className="niche-browser reveal" data-d="2">
        <div className="browser-bar">
          <span className="dots"><i /><i /><i /></span>
          <span className="url">
            <svg className="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            althoscrm.com.br{seg.href}
          </span>
        </div>
        <div className="sol-tabbar" role="tablist" aria-label="Nichos atendidos pelo Althos">
          {SEGMENTS.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              role="tab"
              aria-selected={active === i}
              className={`sol-tab${active === i ? ' active' : ''}`}
              onClick={() => setActive(i)}
            >
              {s.h}
            </button>
          ))}
        </div>
        <div className="niche-panel">
          <span className="seg-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>{seg.icon}</svg>
          </span>
          <div className="niche-panel-title">
            <h3>{seg.h}</h3>
            {seg.tag && <span className="seg-tag">{seg.tag}</span>}
          </div>
          <p>{seg.p}</p>
          <ul className="sol-bullets">
            {seg.bullets.map(b => (
              <li key={b}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6L9 17l-5-5" /></svg>
                {b}
              </li>
            ))}
          </ul>
          <a href={seg.href} className="btn btn-solid">Ver solução completa <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </section>
  )
}
