'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock } from 'lucide-react'
import { scheduleWhatsappMessage } from '@/actions/whatsapp'

type Template = {
  id: string
  display_name: string
  name: string
  body_text: string
  variable_names: string[] | null
  status: string
}

interface Props {
  orgSlug: string
  conversationId: string
  /** Current composer text — what will be scheduled. */
  text: string
  templates: Template[]
  /** Called after a successful schedule (clear composer + refresh server data). */
  onScheduled: () => void
}

/** Default suggestion: one hour from now, rounded to the minute, in local time. */
function defaultLocalValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setSeconds(0, 0)
  // Build a 'YYYY-MM-DDTHH:mm' string in LOCAL time for datetime-local input.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ScheduleMessageButton({ orgSlug, conversationId, text, templates, onScheduled }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [when, setWhen] = useState(defaultLocalValue)
  const [templateId, setTemplateId] = useState('')
  const [vars, setVars] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === templateId) || null,
    [templates, templateId],
  )
  const varNames = selectedTemplate?.variable_names || []

  async function handleSchedule() {
    if (!text.trim()) {
      toast.error('Digite a mensagem antes de agendar.')
      return
    }
    if (!when) {
      toast.error('Escolha a data e a hora.')
      return
    }
    const sendAt = new Date(when)
    if (isNaN(sendAt.getTime())) {
      toast.error('Data inválida.')
      return
    }

    // Coleta as variáveis na ordem em que o template as define.
    const variables = varNames.map(n => (vars[n] || '').trim())
    if (templateId && variables.some(v => !v)) {
      toast.error('Preencha todas as variáveis do template de fallback.')
      return
    }

    setSaving(true)
    const res = await scheduleWhatsappMessage(
      orgSlug,
      conversationId,
      text,
      sendAt.toISOString(),
      templateId || null,
      variables,
    )
    setSaving(false)

    if (!res.ok) {
      toast.error('Não foi possível agendar', { description: res.error })
      return
    }
    toast.success('Mensagem agendada.')
    setOpen(false)
    setTemplateId('')
    setVars({})
    setWhen(defaultLocalValue())
    onScheduled()
    router.refresh()
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground ${open ? 'bg-muted text-primary' : ''}`}
        title="Agendar envio"
        aria-label="Agendar envio"
      >
        <Clock className="w-[22px] h-[22px]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-12 left-0 z-20 w-80 bg-background border rounded-none   p-4 space-y-3">
            <div className="font-semibold text-sm">Agendar mensagem</div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Enviar em</label>
              <Input
                type="datetime-local"
                value={when}
                onChange={e => setWhen(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Template (caso esteja fora da janela de 24h)
              </label>
              <select
                value={templateId}
                onChange={e => { setTemplateId(e.target.value); setVars({}) }}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Nenhum — falha se fora de 24h</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.display_name}{t.status !== 'approved' ? ' (não aprovado)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {varNames.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Variáveis do template</div>
                {varNames.map((n, i) => (
                  <Input
                    key={n}
                    placeholder={`${i + 1}. ${n}`}
                    value={vars[n] || ''}
                    onChange={e => setVars(prev => ({ ...prev, [n]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                ))}
              </div>
            )}

            <p className="text-[11px] leading-snug text-muted-foreground">
              Dentro de 24h da última resposta do cliente, enviamos seu texto.
              Fora disso, usamos o template selecionado (se houver).
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleSchedule} disabled={saving}>
                {saving ? 'Agendando…' : 'Agendar'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
