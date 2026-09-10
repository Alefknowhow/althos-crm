'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { Input } from '@/components/ui/input'
import { MessageSquareText } from 'lucide-react'
import { sendWhatsappTemplateNow } from '@/actions/whatsapp'

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
  templates: Template[]
  /** Chamado depois de um envio bem-sucedido (o pai dá router.refresh()). */
  onSent: () => void
}

/** Substitui {{1}}, {{2}}… no corpo do template pelas variáveis — mesma
 *  lógica de lib/whatsapp/scheduled-delivery.ts::renderTemplateBody, só que
 *  no client (não dá pra importar código de servidor aqui). */
function renderPreview(bodyText: string, variables: string[]): string {
  let out = bodyText || ''
  variables.forEach((v, i) => { out = out.replaceAll(`{{${i + 1}}}`, v || `{{${i + 1}}}`) })
  return out
}

export default function SendTemplateButton({ orgSlug, conversationId, templates, onSent }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [vars, setVars] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

  const approvedTemplates = useMemo(() => templates.filter(t => t.status === 'approved'), [templates])
  const selectedTemplate = useMemo(
    () => approvedTemplates.find(t => t.id === templateId) || null,
    [approvedTemplates, templateId],
  )
  const varNames = selectedTemplate?.variable_names || []

  function reset() {
    setTemplateId('')
    setVars({})
  }

  async function handleSend() {
    if (!selectedTemplate) {
      toast.error('Selecione um template aprovado.')
      return
    }
    const variables = varNames.map(n => (vars[n] || '').trim())
    if (variables.some(v => !v)) {
      toast.error('Preencha todas as variáveis do template.')
      return
    }

    setSending(true)
    const res = await sendWhatsappTemplateNow(orgSlug, conversationId, selectedTemplate.id, variables)
    setSending(false)

    if (!res.ok) {
      toast.error('Não foi possível enviar', { description: res.error })
      return
    }
    toast.success('Template enviado.')
    setOpen(false)
    reset()
    onSent()
    router.refresh()
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`min-h-[38px] min-w-[38px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground ${open ? 'bg-muted text-primary' : ''}`}
        title="Enviar template"
        aria-label="Enviar template"
      >
        <MessageSquareText className="w-[19px] h-[19px] sm:w-[22px] sm:h-[22px]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-12 left-0 z-20 w-80 bg-background border rounded-none p-4 space-y-3">
            <div className="font-semibold text-sm">Enviar template</div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Template aprovado</label>
              {approvedTemplates.length > 0 ? (
                <select
                  value={templateId}
                  onChange={e => { setTemplateId(e.target.value); setVars({}) }}
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Selecione um template…</option>
                  {approvedTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.display_name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhum template aprovado ainda — crie um em Operações › Templates WA.
                </p>
              )}
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

            {selectedTemplate && (
              <p className="text-[11px] leading-snug text-muted-foreground border-t pt-2">
                {renderPreview(selectedTemplate.body_text, varNames.map(n => vars[n] || ''))}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={handleSend} disabled={sending || !selectedTemplate}>
                {sending ? 'Enviando…' : 'Enviar agora'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
