'use client'

/**
 * Onboarding tour — welcome dialog + 6-step spotlight.
 *
 * Triggers automatically on the user's first visit to the org dashboard
 * (gated by a localStorage flag). The user can also re-run it anytime via
 * the Cmd+K palette ("Refazer tour"), which dispatches a custom event
 * this component listens for.
 *
 * Why localStorage, not a DB column: the flag is purely a UI affordance.
 * If a user clears storage, the tour reappears — harmless. Avoids a
 * round-trip migration for a 60-second hand-holding UX.
 *
 * The spotlight is built from four `position: fixed` dim panels around
 * the target's bounding rect (no clip-path tricks). On every step we
 * re-measure the target and reposition. We listen to resize + scroll to
 * stay aligned if the user moves the page.
 */

import { useEffect, useState, useCallback } from 'react'

// useLayoutEffect is not safe on the server — use useEffect instead.
// For DOM measurement this is fine since we only measure after mount.
const useLayoutEffect = useEffect
import { createPortal } from 'react-dom'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import { SpotlightOverlay, type Step } from './OnboardingTourOverlay'

const STORAGE_KEY = 'althos.tour.v1.seen'
const REPLAY_EVENT = 'althos:tour:replay'

const STEPS: Step[] = [
  {
    selector: '[data-tour="cmdk"]',
    title: 'Atalho rápido: ⌘K',
    body: 'Aperte ⌘K (ou Ctrl+K) de qualquer tela pra buscar leads, clientes ou pular pra qualquer seção. É o jeito mais rápido de se mover.',
    side: 'bottom',
  },
  {
    selector: '[data-tour="pipeline"]',
    title: 'Pipeline visual',
    body: 'Aqui você arrasta leads entre estágios. Crie quantos pipelines quiser — um pra vendas, um pra recuperação, um pra eventos.',
    side: 'right',
  },
  {
    selector: '[data-tour="leads"]',
    title: 'Lista de leads',
    body: 'Filtre por origem, score IA, tags, tempo sem contato. Salva os filtros que mais usa.',
    side: 'right',
  },
  {
    selector: '[data-tour="forms"]',
    title: 'Formulários públicos',
    body: 'Crie um formulário em 30s, publique o link e os leads caem direto no pipeline com UTMs e tudo.',
    side: 'right',
  },
  {
    selector: '[data-tour="agendamentos"]',
    title: 'Agendamentos',
    body: 'Link público estilo Calendly — sem dependência externa. Compartilhe e o lead escolhe o horário.',
    side: 'right',
  },
  {
    selector: '[data-tour="insights"]',
    title: 'Insights IA',
    body: 'Pergunte em português: "quais leads tenho mais chance de fechar essa semana?" — a IA responde com dados reais do seu CRM.',
    side: 'right',
  },
]

type Phase = 'idle' | 'welcome' | 'running' | 'done'

export default function OnboardingTour({ userName }: { userName?: string }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)

  // SSR-safe portal mount.
  useEffect(() => {
    setMounted(true)
  }, [])

  // First-visit auto-trigger + replay event listener.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      // Slight delay so the dashboard's first paint completes — avoids
      // the dialog landing on top of a still-rendering layout.
      const t = setTimeout(() => setPhase('welcome'), 600)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    function onReplay() {
      setStep(0)
      setPhase('welcome')
    }
    window.addEventListener(REPLAY_EVENT, onReplay)
    return () => window.removeEventListener(REPLAY_EVENT, onReplay)
  }, [])

  // Measure target rect on step change, scroll, resize. Skip step if the
  // target isn't on the page (e.g. mobile view hides desktop sidebar).
  const measure = useCallback(() => {
    if (phase !== 'running') return
    const s = STEPS[step]
    if (!s) return
    const el = document.querySelector(s.selector) as HTMLElement | null
    if (!el) {
      setRect(null)
      return
    }
    // Bring target into view if needed — but only vertical scroll, no
    // horizontal so we don't shake the layout sideways.
    const r = el.getBoundingClientRect()
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    setRect(el.getBoundingClientRect())
  }, [phase, step])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    if (phase !== 'running') return
    const onChange = () => measure()
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
    }
  }, [phase, measure])

  // ESC anywhere closes the tour.
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  function start() {
    setStep(0)
    setPhase('running')
  }

  function next() {
    if (step + 1 >= STEPS.length) {
      finish()
      return
    }
    setStep(s => s + 1)
  }

  function prev() {
    setStep(s => Math.max(0, s - 1))
  }

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      // localStorage can throw in some privacy modes — fine, we just
      // skip persisting and the tour will reappear next session.
    }
    setPhase('done')
  }

  if (!mounted) return null

  // ----------------- Welcome dialog -----------------
  if (phase === 'welcome') {
    return createPortal(
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="absolute inset-0 bg-black/60  "
          onClick={finish}
        />
        <div className="relative w-full max-w-md bg-card border border-border rounded-none   p-6 animate-in fade-in zoom-in-95 duration-200">
          <button
            type="button"
            onClick={finish}
            aria-label="Fechar"
            className="absolute top-3 right-3 w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            {userName ? `Bem-vindo, ${userName.split(' ')[0]}!` : 'Bem-vindo ao Althos CRM!'}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Quer um tour rápido (60 segundos) pelos principais pontos do CRM?
            Você pode pular agora e refazer depois pelo atalho ⌘K.
          </p>
          <div className="flex items-center justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={finish}
              className="h-9 px-4 text-sm rounded-md hover:bg-muted text-muted-foreground"
            >
              Agora não
            </button>
            <button
              type="button"
              onClick={start}
              className="h-9 px-4 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5"
            >
              Começar tour
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  // ----------------- Spotlight + tooltip -----------------
  if (phase === 'running') {
    const s = STEPS[step]
    return createPortal(
      <SpotlightOverlay
        rect={rect}
        step={s}
        index={step}
        total={STEPS.length}
        onNext={next}
        onPrev={prev}
        onSkip={finish}
      />,
      document.body,
    )
  }

  return null
}

/** Imperative trigger — call from anywhere (e.g. Cmd+K) to replay the tour. */
export function replayOnboardingTour() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(REPLAY_EVENT))
}
