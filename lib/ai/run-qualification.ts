/**
 * Runs the full AI qualification pipeline for a single lead.
 * Shared by:
 *   - The direct server action (RequalifyButton)
 *   - The Inngest background function (form submit trigger)
 *
 * Returns a result object so callers can surface errors to the user.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { qualifyLead } from './qualifier'
import { getPlatformAiKey } from './api-key'

export type RunQualificationResult =
  | { ok: true; score: number; tier: string }
  | { ok: false; reason: string }

export async function runLeadQualification(
  leadId: string,
  orgId: string,
  formId?: string | null,
): Promise<RunQualificationResult> {
  const supabase = createAdminClient()

  // 1) Org config
  const { data: orgConfig } = await supabase
    .from('organizations')
    .select('ai_enabled, ai_qualifier_model, ai_qualifier_prompt, ai_business_context, account_id')
    .eq('id', orgId)
    .maybeSingle()

  if (!orgConfig?.ai_enabled)  return { ok: false, reason: 'AI desabilitada para esta organização' }
  // AI runs on the platform's centralized token (env), metered per account by
  // the credit system below — no per-org API key required.
  const apiKey = getPlatformAiKey()
  if (!apiKey) return { ok: false, reason: 'IA temporariamente indisponível. Tente novamente em instantes.' }

  // 1b) Plan gate (per account). This runs in a service-role/background context
  //     (Inngest, webhooks) with no user JWT, so we call the gating RPCs through
  //     the admin client directly. Lead scoring is included from the Pro plan.
  //     Fail CLOSED on feature, but never block on a credit infra error.
  const accountId = (orgConfig as any).account_id as string | null
  if (accountId) {
    const { data: allowed, error: featErr } = await supabase.rpc('account_has_feature', {
      p_account_id: accountId,
      p_feature: 'lead_scoring',
    })
    if (featErr) {
      console.error('[runLeadQualification] account_has_feature error:', featErr.message)
    } else if (allowed !== true) {
      return { ok: false, reason: 'Lead scoring com IA não está disponível no plano desta conta.' }
    }

    // Debit 1 credit for the scoring action.
    const { data: credit, error: creditErr } = await supabase.rpc('consume_ai_credits', {
      p_account_id: accountId,
      p_action: 'lead_scoring',
      p_credits: 1,
      p_contato_id: leadId,
      p_metadata: { feature: 'lead_scoring', orgId },
    })
    if (creditErr) {
      console.error('[runLeadQualification] consume_ai_credits error:', creditErr.message)
    } else if (credit && (credit as any).success === false) {
      return { ok: false, reason: 'Créditos de IA esgotados para esta conta neste mês.' }
    }
  }

  // 2) Lead
  const { data: lead } = await supabase
    .from('contatos')
    .select('id, name, email, phone, source, tags, value_cents, custom_fields, organization_id')
    .eq('id', leadId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!lead) return { ok: false, reason: 'Lead não encontrado' }

  // 3) Form schema (optional — enriches field labels)
  let formSchema: { fields: Array<{ id: string; label: string; type: string }> } | null = null
  if (formId) {
    const { data: form } = await supabase
      .from('forms')
      .select('schema')
      .eq('id', formId)
      .maybeSingle()
    formSchema = (form?.schema as any) || null
  } else if (lead.custom_fields && Object.keys(lead.custom_fields).length > 0) {
    // No formId passed — try to find the most recent form submission for this lead
    const { data: sub } = await supabase
      .from('form_submissions')
      .select('form_id, forms(schema)')
      .eq('contato_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sub) {
      const schema = Array.isArray(sub.forms)
        ? (sub.forms[0] as any)?.schema
        : (sub.forms as any)?.schema
      formSchema = schema || null
    }
  }

  // 4) Call Claude
  let qualification: Awaited<ReturnType<typeof qualifyLead>>
  try {
    qualification = await qualifyLead(
      {
        lead: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          tags: lead.tags,
          value_cents: lead.value_cents,
          custom_fields: lead.custom_fields,
        },
        formSchema,
      },
      {
        apiKey,
        model: orgConfig.ai_qualifier_model || 'claude-haiku-4-5',
        systemPrompt: orgConfig.ai_qualifier_prompt,
        businessContext: orgConfig.ai_business_context,
      },
    )
  } catch (err: any) {
    console.error('[runLeadQualification] qualifyLead error:', err?.message)
    return { ok: false, reason: `Erro ao chamar a IA: ${err?.message || 'unknown'}` }
  }

  const { result, usage, modelUsed } = qualification

  // 5) Persist
  const mergedTags = Array.from(new Set([...(lead.tags || []), ...result.tags]))

  const { error: updateErr } = await supabase
    .from('contatos')
    .update({
      ai_score:        result.score,
      ai_tier:         result.tier,
      ai_summary:      result.reason,
      ai_qualified_at: new Date().toISOString(),
      tags:            mergedTags,
    })
    .eq('id', leadId)
    .eq('organization_id', orgId)

  if (updateErr) {
    console.error('[runLeadQualification] update error:', updateErr.message)
    return { ok: false, reason: 'Erro ao salvar o score no banco de dados' }
  }

  // Activity log — best effort
  await supabase.from('contato_activities').insert({
    contato_id:         leadId,
    organization_id: orgId,
    type:            'ai_qualified',
    payload: {
      score:    result.score,
      tier:     result.tier,
      reason:   result.reason,
      tags:     result.tags,
      concerns: result.concerns,
      model:    modelUsed,
      usage,
    },
  })

  // ── Meta CAPI: NotQualified when AI tier is cold ───────────────────────────
  if (result.tier === 'cold') {
    try {
      const { data: orgMeta } = await supabase
        .from('organizations')
        .select('meta_pixel_id, meta_access_token')
        .eq('id', orgId)
        .maybeSingle()

      if (orgMeta?.meta_pixel_id && orgMeta?.meta_access_token) {
        const { sendCapiEvent } = await import('@/lib/meta/capi')
        await sendCapiEvent({
          pixelId:     orgMeta.meta_pixel_id,
          accessToken: orgMeta.meta_access_token,
          eventName:   'NotQualified',
          eventId:     `${leadId}-cold`,
          email:       lead.email,
          phone:       lead.phone,
          firstName:   lead.name,
        })
      }
    } catch (capiErr: any) {
      // Non-blocking: qualification result already persisted
      console.error('[runLeadQualification] CAPI NotQualified error:', capiErr?.message)
    }
  }

  return { ok: true, score: result.score, tier: result.tier }
}
