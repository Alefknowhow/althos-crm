import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Funil da proposta pública (§ tracking da cotação reformulada):
 *
 *  - proposal.viewed      → cliente abriu o link
 *  - proposal.cta_clicked → clicou em "Reservar" ou "Tirar dúvidas"
 *
 * Quando a cotação está vinculada a um contato, registra a atividade na
 * timeline e soma pontos no lead scoring (ai_score, teto 100):
 * visualização +5, CTA +15 (reservar) / +10 (dúvidas).
 */
export const proposalEventFn = inngest.createFunction(
  { id: 'proposal-engagement' },
  [{ event: 'proposal.viewed' }, { event: 'proposal.cta_clicked' }],
  async ({ event, step }) => {
    const { orgId, proposalId, contatoId, cta } = event.data as {
      orgId: string; proposalId: string; contatoId?: string | null; cta?: string
    }
    if (!orgId || !proposalId) return { skipped: 'payload incompleto' }

    const isView = event.name === 'proposal.viewed'
    const points = isView ? 5 : cta === 'reservar' ? 15 : 10

    await step.run('register-activity', async () => {
      if (!contatoId) return 'sem contato vinculado'
      const supabase = createAdminClient()
      await supabase.from('contato_activities').insert({
        contato_id: contatoId,
        organization_id: orgId,
        type: isView ? 'proposal_viewed' : 'proposal_cta',
        payload: { proposal_id: proposalId, ...(cta ? { cta } : {}) },
      })
      return 'ok'
    })

    await step.run('bump-lead-score', async () => {
      if (!contatoId) return 'sem contato vinculado'
      const supabase = createAdminClient()
      const { data: c } = await supabase
        .from('contatos').select('ai_score')
        .eq('id', contatoId).eq('organization_id', orgId).maybeSingle()
      if (!c) return 'contato não encontrado'
      const next = Math.min(100, (c.ai_score ?? 0) + points)
      if (next !== c.ai_score) {
        await supabase.from('contatos').update({ ai_score: next }).eq('id', contatoId)
      }
      return `score ${c.ai_score ?? 0} → ${next}`
    })

    return { event: event.name, points }
  },
)
