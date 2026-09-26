'use client'

/**
 * Composer padrão de todos os chats de IA do CRM (issue #68) — textarea
 * multilinha com auto-resize, microfone (STT via VoiceInputButton,
 * obrigatório em todo chat de IA) e envio. Enter envia, Shift+Enter quebra
 * linha. Substitui os `<form>` + `<Input>`/`<Textarea>` reimplementados em
 * cada módulo (CopilotDock, FinancialAiChat, TrafficAgentChat, etc.).
 */

import { useEffect, useRef } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { VoiceInputButton } from './VoiceInputButton'

const MAX_HEIGHT_PX = 160

export function AIComposer({
  orgSlug,
  value,
  onChange,
  onSend,
  disabled,
  sending,
  placeholder = 'Pergunte ao Althos AI...',
  autoFocus,
  className,
}: {
  orgSlug: string
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  sending?: boolean
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value])

  function handleSend() {
    if (disabled || sending || !value.trim()) return
    onSend()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={cn(
        'relative flex items-end gap-2 rounded-2xl border border-border/70 bg-muted/40',
        'focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30',
        'px-2 py-2 transition-colors',
        className,
      )}
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={1}
        className="flex-1 min-h-9 max-h-40 resize-none border-none bg-transparent shadow-none focus-visible:ring-0 text-[15px] py-1.5 leading-snug"
      />
      <VoiceInputButton
        orgSlug={orgSlug}
        onTranscribed={text => onChange(value.trim() ? `${value.trim()} ${text}` : text)}
        disabled={disabled}
        className="h-9 w-9 rounded-xl shrink-0"
      />
      <Button
        type="button"
        size="icon"
        disabled={disabled || sending || !value.trim()}
        onClick={handleSend}
        className="h-9 w-9 shrink-0 rounded-xl"
        aria-label="Enviar"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </Button>
    </div>
  )
}
