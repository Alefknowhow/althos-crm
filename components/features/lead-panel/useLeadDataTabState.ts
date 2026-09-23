import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatCurrency, parseCurrency } from '@/lib/utils'
import {
  updateLead, updateLeadValue, updateLeadTags, assignLead, moveLeadToStage,
  resolveContatoAvatars, addNegotiationAction,
} from '@/actions/contatos'
import { isNegotiationStage } from '@/components/features/pipeline/StageMoveDialogs'
import type { ActivityItem, Stage } from './LeadDataTab'

/**
 * Estado + handlers do formulário de dados do lead — extraído de
 * LeadDataTab (que passou do limite de 350 linhas do lint). Mesma lógica,
 * arquivo próprio.
 */
export function useLeadDataTabState(
  orgSlug: string,
  lead: any,
  fallbackPhone: string | null | undefined,
  stages: Stage[],
  onActionAdded?: (activity: ActivityItem) => void,
) {
  const router = useRouter()
  const [name, setName] = useState(lead?.name ?? '')
  const [email, setEmail] = useState(lead?.email ?? '')
  const [phone, setPhone] = useState(lead?.phone ?? fallbackPhone ?? '')
  const [cpf, setCpf] = useState(lead?.cpf ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(lead?.date_of_birth ?? '')
  const [value, setValue] = useState(lead?.value_cents ? formatCurrency(lead.value_cents) : '')
  const [tags, setTags] = useState<string[]>(lead?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(lead?.avatar_url ?? null)
  const [internalNotes, setInternalNotes] = useState(lead?.internal_notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [actionText, setActionText] = useState('')
  const [savingAction, setSavingAction] = useState(false)

  // Popups ao mover pra etapa is_won/is_lost/"Negociação" — mesma regra do
  // Kanban (ver components/features/pipeline/StageMoveDialogs.tsx), só que
  // aqui a troca é feita direto num <select>, sem otimismo visual: só muda
  // de fato depois da confirmação.
  const [lostPrompt, setLostPrompt] = useState<string | null>(null)
  const [wonPrompt, setWonPrompt] = useState<string | null>(null)
  const [negotiationPrompt, setNegotiationPrompt] = useState<string | null>(null)

  useEffect(() => {
    setName(lead?.name ?? '')
    setEmail(lead?.email ?? '')
    setPhone(lead?.phone ?? fallbackPhone ?? '')
    setCpf(lead?.cpf ?? '')
    setDateOfBirth(lead?.date_of_birth ?? '')
    setValue(lead?.value_cents ? formatCurrency(lead.value_cents) : '')
    setTags(lead?.tags ?? [])
    setTagDraft('')
    setAvatarUrl(lead?.avatar_url ?? null)
    setInternalNotes(lead?.internal_notes ?? '')
  }, [lead?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve avatar_storage_object_id -> signed URL do R2, quando aplicável
  // (lead legado/instagram com avatar_url direto não precisa disso — ver
  // resolveContatoAvatars em actions/contatos.ts).
  useEffect(() => {
    if (!lead?.id || !lead?.avatar_storage_object_id) return
    let active = true
    resolveContatoAvatars(orgSlug, [{ avatar_url: lead.avatar_url ?? null, avatar_storage_object_id: lead.avatar_storage_object_id }])
      .then(([resolved]) => { if (active && resolved?.avatar_url) setAvatarUrl(resolved.avatar_url) })
      .catch(() => {})
    return () => { active = false }
  }, [orgSlug, lead?.id, lead?.avatar_storage_object_id, lead?.avatar_url])

  async function handleSaveContact() {
    setSavingContact(true)
    const fd = new FormData()
    fd.set('name', name)
    fd.set('email', email)
    fd.set('phone', phone)
    fd.set('cpf', cpf)
    fd.set('date_of_birth', dateOfBirth)
    const res = await updateLead(orgSlug, lead.id, fd)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar', { description: (res as any).error })
    else toast.success('Dados de contato atualizados')
    setSavingContact(false)
    router.refresh()
  }

  async function handleSaveValue() {
    const cents = parseCurrency(value)
    const res = await updateLeadValue(orgSlug, lead.id, cents)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar o valor', { description: (res as any).error })
    else toast.success('Valor atualizado')
    router.refresh()
  }

  async function commitStageChange(
    stageId: string,
    closeInfo?: { dealStatus: 'perdido' | 'desqualificado'; reason: string },
    valueCents?: number,
  ) {
    const res = await moveLeadToStage(orgSlug, lead.id, stageId, lead.stage_id, closeInfo, valueCents)
    if ((res as any)?.ok === false) toast.error('Não foi possível mover de estágio', { description: (res as any).error })
    else {
      toast.success('Estágio atualizado')
      if (valueCents != null) setValue(formatCurrency(valueCents))
    }
    router.refresh()
  }

  function handleChangeStage(stageId: string) {
    if (stageId === lead.stage_id) return
    const stage = stages.find(s => s.id === stageId)
    if (stage?.is_lost) { setLostPrompt(stageId); return }
    if (stage?.is_won) { setWonPrompt(stageId); return }
    if (isNegotiationStage(stage)) { setNegotiationPrompt(stageId); return }
    commitStageChange(stageId)
  }

  async function saveTags(next: string[]) {
    setTags(next)
    const res = await updateLeadTags(orgSlug, lead.id, next)
    if ((res as any)?.ok === false) toast.error('Não foi possível salvar as tags', { description: (res as any).error })
    router.refresh()
  }

  function handleAddTag() {
    const t = tagDraft.trim()
    if (!t) return
    if (!tags.includes(t)) saveTags([...tags, t])
    setTagDraft('')
  }

  function handleRemoveTag(t: string) {
    saveTags(tags.filter(x => x !== t))
  }

  async function handleAssignLeadOwner(userId: string | null) {
    const res = await assignLead(orgSlug, lead.id, userId)
    if ((res as any)?.ok === false) toast.error('Não foi possível atribuir', { description: (res as any).error })
    else toast.success('Responsável atualizado')
    router.refresh()
  }

  // Observação — campo único editável em contatos.internal_notes (não é
  // mais uma lista de entradas em contato_activities: um só lugar pra
  // olhar e decidir, a timeline de Ações cobre o histórico de tentativas).
  async function handleSaveNotes() {
    setSavingNotes(true)
    const fd = new FormData()
    fd.set('internal_notes', internalNotes)
    const res = await updateLead(orgSlug, lead.id, fd)
    setSavingNotes(false)
    if ((res as any)?.ok === false) { toast.error('Não foi possível salvar a observação', { description: (res as any).error }); return }
    toast.success('Observação salva')
  }

  async function handleAddAction() {
    const v = actionText.trim()
    if (!v) return
    setSavingAction(true)
    const res = await addNegotiationAction(orgSlug, lead.id, v)
    setSavingAction(false)
    if (!res.ok) { toast.error('Não foi possível registrar a ação', { description: res.error }); return }
    setActionText('')
    toast.success('Ação registrada — veja na Timeline')
    if (onActionAdded && res.activity) onActionAdded({ ...res.activity, created_by_name: null } as ActivityItem)
  }

  return {
    name, setName, email, setEmail, phone, setPhone, cpf, setCpf, dateOfBirth, setDateOfBirth,
    value, setValue, tags, tagDraft, setTagDraft, savingContact, avatarUrl, internalNotes, setInternalNotes,
    savingNotes, actionText, setActionText, savingAction,
    lostPrompt, setLostPrompt, wonPrompt, setWonPrompt, negotiationPrompt, setNegotiationPrompt,
    handleSaveContact, handleSaveValue, commitStageChange, handleChangeStage,
    handleAddTag, handleRemoveTag, handleAssignLeadOwner, handleSaveNotes, handleAddAction,
  }
}
