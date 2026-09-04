'use client'

/**
 * NPS (Net Promoter Score) do cliente — disparo manual da pesquisa por
 * WhatsApp (mesmo texto fixo usado pela automação "Enviar pesquisa NPS",
 * ver lib/nps/send-survey.ts) e registro manual da nota enquanto a leitura
 * automática da resposta não existe (pipeline de ingestão do WhatsApp em
 * refatoração — ver contatos-customers.ts::setNpsScore).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Smile, Send, Loader2 } from 'lucide-react'
import { triggerNpsSurvey, setNpsScore } from '@/actions/contatos'

type NpsStatus = 'none' | 'aguardando' | 'respondido'

const STATUS_LABEL: Record<NpsStatus, string> = {
  none: 'Nunca enviada',
  aguardando: 'Aguardando resposta',
  respondido: 'Respondida',
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('pt-BR')
}

export function NpsSection({
  orgSlug, leadId, phone, npsScore, npsStatus, npsSentAt, npsRespondedAt,
}: {
  orgSlug: string
  leadId: string
  phone: string | null
  npsScore: number | null
  npsStatus: NpsStatus | null
  npsSentAt: string | null
  npsRespondedAt: string | null
}) {
  const router = useRouter()
  const status = npsStatus || 'none'
  const [sending, setSending] = useState(false)
  const [scoreInput, setScoreInput] = useState(npsScore != null ? String(npsScore) : '')
  const [savingScore, setSavingScore] = useState(false)

  async function handleSend() {
    setSending(true)
    const res = await triggerNpsSurvey(orgSlug, leadId)
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
          <Smile className="w-3.5 h-3.5" /> NPS
        </p>
        <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[status]}</Badge>
      </div>

      {npsScore != null && (
        <div className="text-sm">
          <span className="font-semibold text-lg tabular-nums">{npsScore}</span>
          <span className="text-muted-foreground"> / 10</span>
          {npsRespondedAt && <span className="text-xs text-muted-foreground ml-2">respondido em {fmtDate(npsRespondedAt)}</span>}
        </div>
      )}
      {status === 'aguardando' && npsSentAt && (
        <p className="text-xs text-muted-foreground">Pesquisa enviada em {fmtDate(npsSentAt)}, ainda sem resposta.</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleSend} disabled={sending || !phone} title={!phone ? 'Contato sem telefone cadastrado' : undefined}>
          {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
          Disparar pesquisa
        </Button>
      </div>

      <div className="flex items-center gap-2">
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
