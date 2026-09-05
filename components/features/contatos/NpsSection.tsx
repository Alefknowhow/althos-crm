'use client'

/**
 * NPS (Net Promoter Score) do cliente — disparo manual da pesquisa por
 * WhatsApp usando um template aprovado (a Meta rejeita texto livre fora da
 * janela de 24h de sessão, o caso comum aqui) e registro manual da nota:
 * ler a resposta automaticamente é uma automação separada, ainda não
 * construída — quem lê a resposta digita a nota aqui mesmo.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Smile, Send, Loader2 } from 'lucide-react'
import { triggerNpsSurvey, setNpsScore } from '@/actions/contatos'
import type { WaTemplate } from '@/actions/whatsapp-templates'

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('pt-BR')
}

export function NpsSection({
  orgSlug, leadId, phone, npsScore, npsUpdatedAt, whatsappTemplates,
}: {
  orgSlug: string
  leadId: string
  phone: string | null
  npsScore: number | null
  npsUpdatedAt: string | null
  whatsappTemplates?: WaTemplate[]
}) {
  const router = useRouter()
  const templates = (whatsappTemplates ?? []).filter(t => t.status === 'approved')
  const [templateName, setTemplateName] = useState('')
  const [sending, setSending] = useState(false)
  const [scoreInput, setScoreInput] = useState(npsScore != null ? String(npsScore) : '')
  const [savingScore, setSavingScore] = useState(false)

  const selectedTpl = templates.find(t => t.name === templateName) ?? null

  async function handleSend() {
    if (!templateName) { toast.error('Selecione um template aprovado.'); return }
    setSending(true)
    const res = await triggerNpsSurvey(orgSlug, leadId, { name: templateName, language: selectedTpl?.language })
    setSending(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Pesquisa NPS enviada pelo WhatsApp')
    router.refresh()
  }

  async function handleSaveScore() {
    const n = scoreInput.trim() === '' ? null : parseInt(scoreInput, 10)
    if (n != null && (Number.isNaN(n) || n < 0 || n > 10)) {
      toast.error('A nota precisa ser um número entre 0 e 10.')
      return
    }
    setSavingScore(true)
    const res = await setNpsScore(orgSlug, leadId, n)
    setSavingScore(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(n != null ? 'Nota registrada' : 'Nota removida')
    router.refresh()
  }

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
        <Smile className="w-3.5 h-3.5" /> NPS
      </p>

      {npsScore != null && (
        <div className="text-sm">
          <span className="font-semibold text-lg tabular-nums">{npsScore}</span>
          <span className="text-muted-foreground"> / 10</span>
          {npsUpdatedAt && <span className="text-xs text-muted-foreground ml-2">atualizado em {fmtDate(npsUpdatedAt)}</span>}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {templates.length > 0 ? (
            <select
              className="flex h-8 flex-1 min-w-0 rounded-md border border-input bg-input/25 px-2 text-xs"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
            >
              <option value="">Selecione um template aprovado…</option>
              {templates.map(t => (
                <option key={t.id} value={t.name}>{t.display_name}</option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-muted-foreground flex-1">
              Nenhum template aprovado ainda — crie um em Operações › Templates WA.
            </p>
          )}
          <Button
            type="button" size="sm" variant="outline" onClick={handleSend}
            disabled={sending || !phone || !templateName}
            title={!phone ? 'Contato sem telefone cadastrado' : undefined}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            Disparar
          </Button>
        </div>
        {selectedTpl && <p className="text-[11px] text-muted-foreground line-clamp-2">{selectedTpl.body_text}</p>}
      </div>

      <div className="flex items-center gap-2 border-t pt-3">
        <Input
          type="number" min={0} max={10}
          placeholder="Nota manual (0-10)"
          value={scoreInput}
          onChange={e => setScoreInput(e.target.value)}
          className="h-8 w-40 text-sm"
        />
        <Button type="button" size="sm" variant="ghost" onClick={handleSaveScore} disabled={savingScore}>
          {savingScore ? 'Salvando...' : 'Registrar'}
        </Button>
      </div>
    </div>
  )
}
