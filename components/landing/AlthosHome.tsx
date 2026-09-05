'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { HOME_CSS } from './althos-home.css'
import { SHOTS, type ZoomImg, type OnZoom } from './AlthosHomeShared'
import { Solutions, AiBlock, Segments } from './AlthosHomeFeatures'
import { Stats, Compare } from './AlthosHomeCompare'
import { Onboard, GeoFaq, FinalCta } from './AlthosHomeFooterSections'
import { Pricing } from './AlthosHomePricing'
import { Behaviors } from './AlthosHomeBehaviors'

/* ---------------------------------------------------------------------------
 * AlthosHome — recreação da landing "tech premium dark" do handoff,
 * portada para o stack atual (React/Next + Tailwind shell). Todo o CSS é
 * injetado e escopado sob `.althos-home` (sem regras globais `*`/`body`),
 * então nada vaza para o header/footer (SiteShell) ou outras páginas.
 * O acento roxo do protótipo foi mapeado para o AZUL atual do Althos.
 * ------------------------------------------------------------------------- */

const HERO_TABS = [
  { key: 'pipeline', label: 'Pipeline', alt: 'Pipeline de vendas do Althos CRM' },
  { key: 'dashboard', label: 'Dashboard', alt: 'Dashboard do Althos CRM' },
  { key: 'automacoes', label: 'Automações', alt: 'Editor de automações do Althos CRM' },
  { key: 'insights', label: 'Insights IA', alt: 'Insights IA do Althos CRM' },
] as const

export default function AlthosHome() {
  const [zoom, setZoom] = useState<ZoomImg>(null)
  const onZoom: OnZoom = (src, alt) => setZoom({ src, alt })

  return (
    <div className="althos-home">
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />

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
        <Solutions onZoom={onZoom} />
        <AiBlock onZoom={onZoom} />
        <Segments />
        <Stats />
        <Compare />
        <Onboard />
        <Pricing />
        <GeoFaq />
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
        <div className="eyebrow reveal" data-d="0"><span className="star">✦</span> Feito pra quem vende no WhatsApp</div>
        <h1 className="headline reveal" data-d="1">Mais vendas fechadas.<br /><em>Nenhum lead esquecido.</em></h1>
        <p className="subtitle reveal" data-d="2">
          O Althos CRM organiza seu funil, atende no WhatsApp com IA 24h e garante que nenhuma
          oportunidade esfrie — pra o seu negócio vender mais, todos os dias.
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
            {HERO_TABS.map((t, i) => (
              <div key={t.key} className={`panel${tab === t.key ? ' active' : ''}`}>
                <Image
                  src={SHOTS[t.key]}
                  alt={t.alt}
                  fill
                  sizes="(max-width: 900px) 100vw, 1000px"
                  /* Só a 1ª aba (pipeline, o LCP) carrega com prioridade; as demais
                     ficam lazy para não competirem pela banda do hero. */
                  priority={i === 0}
                  loading={i === 0 ? undefined : 'lazy'}
                  onClick={() => onZoom(SHOTS[t.key], t.alt)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
