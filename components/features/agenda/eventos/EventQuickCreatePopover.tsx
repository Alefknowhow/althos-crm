'use client'

/**
 * Popover leve de criação rápida de evento — aberto ao arrastar (ou clicar)
 * num intervalo vazio da timeline de Semana/Dia, ancorado ao lado do
 * intervalo selecionado (estilo Google Agenda), sem overlay bloqueando o
 * resto da tela. Fecha ao clicar fora. Só título + horário (do arraste) +
 * salvar — "Mais opções" abre o EventDialog completo (tipo, local,
 * participantes, relacionamentos).
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { createEvent } from '@/actions/events'
import type { EventInput } from '@/lib/validators/event'
import { cn } from '@/lib/utils'

export type EventRangeSelection = {
  day: string
  startTime: string
  endTime: string
  /** Retângulo (coords de viewport) do intervalo arrastado — ancora o
   *  popover do lado, sem centralizar na tela. */
  anchor: { top: number; bottom: number; left: number; right: number }
}

function fmtLabel(day: string, startTime: string, endTime: string): string {
  const d = new Date(`${day}T12:00:00`)
  const date = isNaN(d.getTime()) ? day : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
  return `${date} · ${startTime} – ${endTime}`
}

export function EventQuickCreatePopover({
  orgSlug, selection, onClose, onSaved, onMoreOptions,
}: {
  orgSlug: string
  selection: EventRangeSelection
  onClose: () => void
  onSaved?: () => void
  /** Abre o EventDialog completo pré-preenchido com a mesma data/horário. */
  onMoreOptions: (day: string, time: string) => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  async function handleSave() {
    if (!title.trim()) { inputRef.current?.focus(); return }
    setSaving(true)
    const res = await createEvent(orgSlug, {
      title: title.trim(),
      start_date: selection.day,
      start_time: selection.startTime,
      end_date: selection.day,
      end_time: selection.endTime,
      all_day: false,
      event_type: 'presencial',
    } satisfies EventInput)
    setSaving(false)
    if (!res.ok) { toast.error('Erro ao criar evento'); return }
    toast.success('Evento criado!')
    onSaved?.()
    router.refresh()
    onClose()
  }

  const POPOVER_W = 320
  const openLeft = selection.anchor.right + 8 + POPOVER_W > window.innerWidth
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(selection.anchor.top, window.innerHeight - 260),
    left: openLeft ? Math.max(8, selection.anchor.left - 8 - POPOVER_W) : selection.anchor.right + 8,
    width: POPOVER_W,
  }

  return (
    <div ref={ref} style={style} className="z-50 rounded-lg border bg-popover shadow-lg p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder="Adicionar título"
          className={cn('flex-1 min-w-0 border-b border-transparent focus:border-border bg-transparent text-sm font-medium pb-1 focus-visible:outline-none')}
        />
        <button type="button" onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground capitalize">{fmtLabel(selection.day, selection.startTime, selection.endTime)}</p>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button type="button" onClick={() => onMoreOptions(selection.day, selection.startTime)} className="text-xs text-primary hover:underline">
          Mais opções
        </button>
        <Button size="sm" pending={saving} onClick={handleSave}>Salvar</Button>
      </div>
    </div>
  )
}
