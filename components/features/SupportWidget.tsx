'use client'

import { useEffect, useRef, useState } from 'react'
import { askSupport, type SupportMessage } from '@/actions/support-chat'
import { supportWhatsappLink, BRAND } from '@/lib/constants/brand'
import { LogoMark } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ExternalLink,
} from 'lucide-react'

type ChatMsg = SupportMessage & { id: string; handoff?: boolean }

const SUGGESTIONS = [
  'Como conecto meu Instagram?',
  'Como funciona o Pipeline?',
  'Como criar uma automação?',
]

function uid() {
  return Math.random().toString(36).slice(2)
}

export function SupportWidget({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  // Mobile-only: tuck the launcher away while the user scrolls the page down
  // (so it never sits on top of action buttons/bars), reveal on scroll up.
  // Desktop keeps it always visible.
  const [tucked, setTucked] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: uid(),
      role: 'assistant',
      content:
        'Olá! 👋 Sou o assistente do Althos. Posso te ajudar a usar as ferramentas, tirar dúvidas e dar dicas. O que você precisa?',
    },
  ])
  const scrollRef = useRef<HTMLDivElement>(null)

  const showHandoff = messages.some((m) => m.handoff)
  const waLink = supportWhatsappLink(
    `Olá! Preciso de ajuda com o ${BRAND.name}.`,
  )

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, open, loading])

  // Hide-on-scroll-down behaviour. The app shell scrolls inside <main>
  // (h-screen + overflow-hidden), not the window — so we listen on that
  // element. Falls back to window if not found. Cheap, passive listener.
  useEffect(() => {
    const scroller: HTMLElement | Window =
      document.querySelector('main') ?? window
    const getY = () =>
      scroller instanceof Window ? scroller.scrollY : scroller.scrollTop
    let lastY = getY()

    function onScroll() {
      const y = getY()
      if (Math.abs(y - lastY) < 8) return // ignore jitter
      // Hide when scrolling down past a small threshold; show when scrolling up.
      setTucked(y > lastY && y > 80)
      lastY = y
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  async function send(text: string) {
    const content = text.trim()
    if (!content || loading) return

    const userMsg: ChatMsg = { id: uid(), role: 'user', content }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const payload: SupportMessage[] = history.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const reply = await askSupport(orgSlug, payload)
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: reply.text,
          handoff: reply.suggestHandoff,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content:
            'Tive um problema para responder agora. Tente novamente ou fale com nossa equipe pelo WhatsApp.',
          handoff: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar suporte' : 'Abrir suporte'}
        className={cn(
          'fixed bottom-5 right-5 z-[60] flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95',
          'bg-gradient-to-br from-brand-500 to-brand-700',
          // Mobile: slide out of the way while scrolling down. Desktop (md+)
          // always stays put regardless of scroll.
          tucked && !open &&
            'translate-y-24 opacity-0 pointer-events-none md:translate-y-0 md:opacity-100 md:pointer-events-auto',
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[60] flex h-[min(70vh,560px)] w-[min(calc(100vw-2.5rem),380px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-br from-brand-600 to-brand-700 px-4 py-3 text-white">
            <LogoMark gradient={false} className="h-8 w-8 text-white/20" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Suporte Althos</p>
              <p className="text-xs text-white/80">Responde na hora, com IA</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex',
                  m.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed',
                    m.role === 'user'
                      ? 'bg-brand-600 text-white'
                      : 'bg-secondary text-foreground',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2.5 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Digitando…</span>
                </div>
              </div>
            )}

            {/* Suggestions (only at start) */}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs text-brand-700 transition-colors hover:bg-brand-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Human handoff CTA */}
            {showHandoff && waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.23 8.23Z" />
                </svg>
                Falar com um humano no WhatsApp
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-center gap-2 border-t border-border p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreva sua dúvida…"
              className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand-300"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
