'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MessageSquare, Mail } from 'lucide-react'
import {
  previewAudienceCount, createCampaignDraft, materializeAndScheduleCampaign,
  type AudienceFilter,
} from '@/actions/send-campaigns'

type Pipeline = { id: string; name: string }
type Stage = { id: string; name: string; pipeline_id: string }
type WaTemplate = { id: string; name: string; display_name: string; language: string; status: string }

const WA_STATUS_LABEL: Record<string, string> = {
  approved: 'Aprovado',
  pending:  'Pendente',
  local:    'Local',
}
type EmailTemplate = { id: string; name: string; subject: string | null; category: string | null }

interface Props {
  orgSlug: string
  pipelines: Pipeline[]
  stages: Stage[]
  tags: string[]
  waTemplates: WaTemplate[]
  emailTemplates: EmailTemplate[]
}

export default function NewCampaignForm({ orgSlug, pipelines, stages, tags, waTemplates, emailTemplates }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [waTemplateId, setWaTemplateId] = useState('')
  const [emailTemplateId, setEmailTemplateId] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now')
  const [scheduleAt, setScheduleAt] = useState('')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const filteredStages = pipelineId ? stages.filter(s => s.pipeline_id === pipelineId) : stages
  const selectedWaTemplate = waTemplates.find(t => t.id === waTemplateId)

  const filter: AudienceFilter = {
    tags: selectedTags,
    stageIds: selectedStages,
    pipelineId: pipelineId || null,
  }

  useEffect(() => {
    let cancelled = false
    previewAudienceCount(orgSlug, filter).then(count => {
      if (!cancelled) setAudienceCount(count)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, JSON.stringify(selectedTags), JSON.stringify(selectedStages), pipelineId])

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function toggleStage(stageId: string) {
    setSelectedStages(prev => prev.includes(stageId) ? prev.filter(s => s !== stageId) : [...prev, stageId])
  }

  function handleConfirm() {
    setError('')
    if (!name.trim()) return setError('Dê um nome à campanha.')
    if (channel === 'whatsapp' && !waTemplateId) return setError('Selecione um template.')
    if (channel === 'email' && !emailTemplateId) return setError('Selecione um template de e-mail.')
    if (sendMode === 'schedule' && !scheduleAt) return setError('Escolha a data/hora do agendamento.')

    startTransition(async () => {
      const draft = await createCampaignDraft(orgSlug, {
        name,
        channel,
        waTemplateId: channel === 'whatsapp' ? waTemplateId : null,
        emailTemplateId: channel === 'email' ? emailTemplateId : null,
        audience: filter,
      })
      if (!draft.ok) return setError(draft.error)

      const sendAtISO = sendMode === 'schedule' ? new Date(scheduleAt).toISOString() : null
      const result = await materializeAndScheduleCampaign(orgSlug, draft.campaignId, sendAtISO)
      if (!result.ok) return setError(result.error)

      router.push(`/app/${orgSlug}/campanhas/${draft.campaignId}`)
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Nome da campanha</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Promoção de Verão" />
      </div>

      <div className="space-y-1.5">
        <Label>Canal</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChannel('whatsapp')}
            className={`flex-1 flex items-center justify-center gap-2 border rounded-none py-2.5 text-sm font-medium transition-colors ${channel === 'whatsapp' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
          >
            <MessageSquare className="w-4 h-4" /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setChannel('email')}
            className={`flex-1 flex items-center justify-center gap-2 border rounded-none py-2.5 text-sm font-medium transition-colors ${channel === 'email' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
          >
            <Mail className="w-4 h-4" /> E-mail
          </button>
        </div>
      </div>

      {channel === 'whatsapp' ? (
        <div className="space-y-1.5">
          <Label>Template</Label>
          {waTemplates.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-none p-3">
              Nenhum template criado ainda. Crie um em Templates de WhatsApp primeiro.
            </p>
          ) : (
            <>
              <Select value={waTemplateId} onValueChange={setWaTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                <SelectContent>
                  {waTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.display_name || t.name} · {WA_STATUS_LABEL[t.status] || t.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedWaTemplate && selectedWaTemplate.status !== 'approved' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-none p-2">
                  Esse template está marcado como &quot;{WA_STATUS_LABEL[selectedWaTemplate.status] || selectedWaTemplate.status}&quot;, não &quot;Aprovado&quot;. Confirme na Meta que ele está realmente aprovado antes de disparar — fora da janela de 24h, só templates aprovados são entregues.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Template de e-mail</Label>
          {emailTemplates.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-none p-3">
              Nenhum template de e-mail criado ainda. Crie um em Templates de E-mail primeiro.
            </p>
          ) : (
            <Select value={emailTemplateId} onValueChange={setEmailTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
              <SelectContent>
                {emailTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="space-y-3 border rounded-none p-4">
        <Label>Público</Label>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Pipeline (opcional)</Label>
          <Select value={pipelineId || '__all__'} onValueChange={v => { setPipelineId(v === '__all__' ? '' : v); setSelectedStages([]) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os pipelines</SelectItem>
              {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {stages.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-normal">Estágios (E)</Label>
            {/* Altura travada (independente da quantidade de estágios do pipeline
                selecionado) pra trocar de pipeline não empurrar o resto do
                formulário pra cima/baixo — rola por dentro se precisar. */}
            <div className="flex flex-wrap content-start gap-1.5 max-h-24 overflow-y-auto">
              {filteredStages.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStage(s.id)}
                  className={`px-2.5 py-1 text-xs rounded-none border transition-colors ${selectedStages.includes(s.id) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-normal">Tags (OU)</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 text-xs rounded-none border transition-colors ${selectedTags.includes(tag) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm font-medium pt-1">
          {audienceCount === null ? 'Calculando...' : `${audienceCount} contato${audienceCount === 1 ? '' : 's'} nesse filtro`}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Quando enviar</Label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setSendMode('now')}
            className={`flex-1 border rounded-none py-2 text-sm font-medium transition-colors ${sendMode === 'now' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
          >
            Enviar agora
          </button>
          <button
            type="button"
            onClick={() => setSendMode('schedule')}
            className={`flex-1 border rounded-none py-2 text-sm font-medium transition-colors ${sendMode === 'schedule' ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
          >
            Agendar
          </button>
        </div>
        {sendMode === 'schedule' && (
          <Input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleConfirm} disabled={pending || !audienceCount} className="w-full">
        {pending ? 'Confirmando...' : `Confirmar e ${sendMode === 'now' ? 'enviar' : 'agendar'}`}
      </Button>
    </div>
  )
}
