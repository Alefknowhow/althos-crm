import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { assignLead, moveLeadToStage } from '@/actions/contatos'
import { isNegotiationStage } from '@/components/features/pipeline/StageMoveDialogs'

// Filtros do inbox (busca/vendedor/estágio) + troca rápida de etapa/
// responsável direto na lista de conversas — extraído de
// useWhatsappChatState.ts pra manter os arquivos de estado abaixo do limite
// de linhas. Pura movimentação de código.
export function useWhatsappChatFiltersState({
  orgSlug, conversations, members, pipelineStages, selectedConversation,
}: any) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filterSeller, setFilterSeller] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Popups ao mover pra etapa is_won/is_lost/"Negociação" — mesma regra do
  // Kanban (ver components/features/pipeline/StageMoveDialogs.tsx).
  const [quickStagePrompt, setQuickStagePrompt] = useState<{
    kind: 'lost' | 'won' | 'negotiation'
    contatoId: string
    currentStageId: string | null
    newStageId: string
    defaultCents: number
  } | null>(null)

  // Troca rápida de etapa/responsável direto na lista de conversas, sem
  // precisar abrir a conversa. contatoId é o lead vinculado à conversa.
  async function commitQuickStageChange(
    contatoId: string, currentStageId: string | null, newStageId: string,
    closeInfo?: { dealStatus: 'perdido' | 'desqualificado'; reason: string },
    valueCents?: number,
  ) {
    const res = await moveLeadToStage(orgSlug, contatoId, newStageId, currentStageId || '', closeInfo, valueCents)
    if ((res as any)?.ok === false) toast.error('Não foi possível mover de etapa', { description: (res as any).error })
    else { toast.success('Etapa atualizada'); router.refresh() }
  }

  function handleQuickStageChange(contatoId: string, currentStageId: string | null, newStageId: string) {
    if (!contatoId || newStageId === currentStageId) return
    const stage = pipelineStages.find((s: any) => s.id === newStageId)
    const defaultCents = conversations.find((c: any) => c.contatos?.id === contatoId)?.contatos?.value_cents || 0
    if (stage?.is_lost) { setQuickStagePrompt({ kind: 'lost', contatoId, currentStageId, newStageId, defaultCents }); return }
    if (stage?.is_won) { setQuickStagePrompt({ kind: 'won', contatoId, currentStageId, newStageId, defaultCents }); return }
    if (isNegotiationStage(stage)) { setQuickStagePrompt({ kind: 'negotiation', contatoId, currentStageId, newStageId, defaultCents }); return }
    commitQuickStageChange(contatoId, currentStageId, newStageId)
  }

  async function handleQuickAssign(contatoId: string, userId: string | null) {
    if (!contatoId) return
    const res = await assignLead(orgSlug, contatoId, userId)
    if ((res as any)?.ok === false) toast.error('Não foi possível atribuir', { description: (res as any).error })
    else { toast.success('Responsável atualizado'); router.refresh() }
  }

  const memberById = useMemo(() => {
    const map: Record<string, any> = {}
    for (const m of members) map[m.user_id] = m
    return map
  }, [members])

  // Estágios disponíveis (derivados das conversas atuais).
  const stageOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of conversations) {
      const n = c.contatos?.pipeline_stages?.name
      if (n) set.add(n)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [conversations])

  // Vendedores que aparecem como responsáveis em alguma conversa.
  const sellerOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const c of conversations) {
      const owner = c.contatos?.assigned_to
      if (owner) ids.add(owner)
    }
    return Array.from(ids).map(id => ({ id, member: memberById[id] }))
  }, [conversations, memberById])

  const activeFilters = (filterSeller ? 1 : 0) + (filterStage ? 1 : 0)

  // Inbox filtrado por busca de texto + vendedor + estágio.
  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations
      .filter((c: any) => {
        // Arquivadas somem da lista principal — exceto a que está aberta
        // agora, senão ela desaparece debaixo do usuário ao arquivar.
        if (c.archived && c.id !== selectedConversation?.id) return false
        if (q) {
          const hay = `${c.contact_name || ''} ${c.contact_phone || ''} ${c.last_message_preview || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        if (filterSeller) {
          const owner = c.contatos?.assigned_to ?? null
          if (filterSeller === '__none' ? !!owner : owner !== filterSeller) return false
        }
        if (filterStage) {
          if ((c.contatos?.pipeline_stages?.name || '') !== filterStage) return false
        }
        return true
      })
      .sort((a: any, b: any) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  }, [conversations, query, filterSeller, filterStage, selectedConversation])

  return {
    query, setQuery, filterSeller, setFilterSeller, filterStage, setFilterStage, showFilters, setShowFilters,
    quickStagePrompt, setQuickStagePrompt, commitQuickStageChange, handleQuickStageChange, handleQuickAssign,
    memberById, stageOptions, sellerOptions, activeFilters, filteredConversations,
  }
}
