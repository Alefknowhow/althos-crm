'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ChevronDown, ChevronUp, Users } from 'lucide-react'
import { createCampaignDrafts, materializeAndScheduleCampaigns } from '@/actions/send-campaigns'
import {
  previewAudienceCount, previewAudienceRecipients,
  type AudienceFilter, type AudienceRecipientPreview,
} from '@/actions/send-campaigns-audience'
import CampaignChannelTemplatePicker, { type SendChannel } from './CampaignChannelTemplatePicker'
import CampaignAudienceMoreFilters from './CampaignAudienceMoreFilters'
import CampaignRecipientsList from './CampaignRecipientsList'

type Pipeline = { id: string; name: string }
type Stage = { id: string; name: string; pipeline_id: string }
type WaTemplate = { id: string; name: string; display_name: string; language: string; status: string }
type EmailTemplate = { id: string; name: string; subject: string | null; category: string | null }

interface Props {
  orgSlug: string
  pipelines: Pipeline[]
  stages: Stage[]
  tags: string[]
  sources: string[]
  waTemplates: WaTemplate[]
  emailTemplates: EmailTemplate[]
}

export default function NewCampaignForm({ orgSlug, pipelines, stages, tags, sources, waTemplates, emailTemplates }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [channels, setChannels] = useState<SendChannel[]>(['whatsapp'])
  const [waTemplateId, setWaTemplateId] = useState('')
  const [emailTemplateId, setEmailTemplateId] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])

  // Mais filtros — colapsado por padrão pra não inchar o formulário.
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [tier, setTier] = useState('')
  const [hasEmail, setHasEmail] = useState(false)
  const [hasPhone, setHasPhone] = useState(false)
  const [noContactDays, setNoContactDays] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [valueMin, setValueMin] = useState('')
  const [valueMax, setValueMax] = useState('')

  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now')
  const [scheduleAt, setScheduleAt] = useState('')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  // Pré-lista: carregada sob demanda, com um checkbox por contato — vazio
  // (null) = ainda não carregada; excludedIds vazio = todo mundo incluso.
  const [recipients, setRecipients] = useState<AudienceRecipientPreview[] | null>(null)
  const [recipientsTruncated, setRecipientsTruncated] = useState(false)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  const filteredStages = pipelineId ? stages.filter(s => s.pipeline_id === pipelineId) : stages

  const filter: AudienceFilter = {
    tags: selectedTags,
    stageIds: selectedStages,
    pipelineId: pipelineId || null,
    status: selectedStatus,
    sources: selectedSources,
    tier,
    hasEmail,
    hasPhone,
    noContactDays: Number(noContactDays) || 0,
    createdFrom,
    createdTo,
    valueMin: Number(valueMin) || 0,
    valueMax: Number(valueMax) || 0,
  }
  const filterKey = JSON.stringify(filter)

  useEffect(() => {
    let cancelled = false
    previewAudienceCount(orgSlug, filter).then(count => {
      if (!cancelled) setAudienceCount(count)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, filterKey])

  // Mudou o filtro depois de já ter carregado a pré-lista — invalida, pra
  // não mandar uma lista de gente que não bate mais com o filtro atual.
  useEffect(() => {
    setRecipients(null)
    setExcludedIds(new Set())
  }, [filterKey])

  function toggleChannel(c: SendChannel) {
    if (c === 'sms') return // ainda não disponível pra campanhas
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }
  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }
  function toggleStage(stageId: string) {
    setSelectedStages(prev => prev.includes(stageId) ? prev.filter(s => s !== stageId) : [...prev, stageId])
  }
  function toggleStatus(s: string) {
    setSelectedStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function toggleSource(s: string) {
    setSelectedSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function loadRecipients() {
    setLoadingRecipients(true)
    const res = await previewAudienceRecipients(orgSlug, filter)
    setRecipients(res.recipients)
    setRecipientsTruncated(res.truncated)
    setExcludedIds(new Set())
    setLoadingRecipients(false)
  }

  function toggleRecipient(id: string) {
    setExcludedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllRecipients() {
    if (!recipients) return
    setExcludedIds(prev => (prev.size === 0 ? new Set(recipients.map(r => r.id)) : new Set()))
  }

  const includedCount = recipients ? recipients.length - excludedIds.size : 0

  function handleConfirm() {
    setError('')
    if (!name.trim()) return setError('Dê um nome à campanha.')
    if (channels.length === 0) return setError('Selecione ao menos um canal.')
    if (channels.includes('whatsapp') && !waTemplateId) return setError('Selecione um template de WhatsApp.')
    if (channels.includes('email') && !emailTemplateId) return setError('Selecione um template de e-mail.')
    if (sendMode === 'schedule' && !scheduleAt) return setError('Escolha a data/hora do agendamento.')
    if (!recipients) return setError('Carregue o público antes de confirmar.')
    if (includedCount === 0) return setError('Nenhum contato selecionado na lista.')

    startTransition(async () => {
      const draft = await createCampaignDrafts(orgSlug, {
        name,
        channels: channels as ('whatsapp' | 'email')[],
        waTemplateId: channels.includes('whatsapp') ? waTemplateId : null,
        emailTemplateId: channels.includes('email') ? emailTemplateId : null,
        audience: filter,
      })
      if (!draft.ok) return setError(draft.error)

      const sendAtISO = sendMode === 'schedule' ? new Date(scheduleAt).toISOString() : null
      const includedIds = recipients.filter(r => !excludedIds.has(r.id)).map(r => r.id)
      const result = await materializeAndScheduleCampaigns(orgSlug, draft.campaignIds, sendAtISO, includedIds)
      if (!result.ok) return setError(result.error)

      router.push(`/app/${orgSlug}/campanhas/${draft.campaignIds[0]}`)
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label>Nome da campanha</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Promoção de Verão" />
      </div>

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

        <button
          type="button"
          onClick={() => setMoreFiltersOpen(o => !o)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground pt-1"
        >
          {moreFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Mais filtros
        </button>

        {moreFiltersOpen && (
          <CampaignAudienceMoreFilters
            sources={sources}
            selectedStatus={selectedStatus} toggleStatus={toggleStatus}
            selectedSources={selectedSources} toggleSource={toggleSource}
            tier={tier} setTier={setTier}
            hasEmail={hasEmail} setHasEmail={setHasEmail}
            hasPhone={hasPhone} setHasPhone={setHasPhone}
            noContactDays={noContactDays} setNoContactDays={setNoContactDays}
            createdFrom={createdFrom} setCreatedFrom={setCreatedFrom}
            createdTo={createdTo} setCreatedTo={setCreatedTo}
            valueMin={valueMin} setValueMin={setValueMin}
            valueMax={valueMax} setValueMax={setValueMax}
          />
        )}

        <p className="text-sm font-medium pt-1">
          {audienceCount === null ? 'Calculando...' : `${audienceCount} contato${audienceCount === 1 ? '' : 's'} nesse filtro`}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 w-full"
          disabled={!audienceCount || loadingRecipients}
          onClick={loadRecipients}
        >
          <Users className="w-3.5 h-3.5" />
          {loadingRecipients ? 'Carregando...' : 'Carregar público'}
        </Button>

        {recipients && (
          <CampaignRecipientsList
            recipients={recipients}
            truncated={recipientsTruncated}
            excludedIds={excludedIds}
            channels={channels}
            onToggle={toggleRecipient}
            onToggleAll={toggleAllRecipients}
          />
        )}
      </div>

      <CampaignChannelTemplatePicker
        channels={channels} toggleChannel={toggleChannel}
        waTemplateId={waTemplateId} setWaTemplateId={setWaTemplateId}
        emailTemplateId={emailTemplateId} setEmailTemplateId={setEmailTemplateId}
        waTemplates={waTemplates} emailTemplates={emailTemplates}
      />

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

      <Button onClick={handleConfirm} disabled={pending || !recipients || includedCount === 0} className="w-full">
        {pending
          ? 'Confirmando...'
          : recipients
          ? `Confirmar e ${sendMode === 'now' ? 'enviar' : 'agendar'} pra ${includedCount} contato${includedCount === 1 ? '' : 's'}`
          : 'Carregue o público antes de confirmar'}
      </Button>
    </div>
  )
}
