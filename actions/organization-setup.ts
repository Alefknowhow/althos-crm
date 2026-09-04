'use server'

/**
 * Org creation and onboarding setup: unique slug, create org, AI
 * qualifier config, onboarding completion. Split out of
 * actions/organization.ts.
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils/slugify'
import { requireAuth, getCurrentOrganization, isSuperAdmin } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { DEFAULT_QUALIFIER_PROMPT } from '@/lib/ai/qualifier-prompt'
import { defaultMemberPermissions } from '@/lib/permissions'

/**
 * Generates a unique slug for a new organization.
 * Uses the admin client (bypasses RLS) so it can see ALL existing slugs,
 * not just the ones the calling user belongs to. Without this, new users
 * with no orgs would always get the first try slug accepted, causing
 * duplicate-slug errors when the RPC runs against the DB constraint.
 */
export async function generateUniqueSlug(name: string) {
  const baseSlug = slugify(name)
  // Admin client bypasses RLS so we see all existing slugs globally
  const supabase = createAdminClient()
  let slug = baseSlug
  let counter = 1
  while (true) {
    const { data } = await supabase.from('organizations').select('id').eq('slug', slug).limit(1)
    if (!data || data.length === 0) {
      break
    }
    slug = `${baseSlug}-${counter}`
    counter++
  }
  return slug
}

export async function createOrganization(formData: FormData) {
  const user = await requireAuth()
  const name = (formData.get('name') as string)?.trim()
  // Niche chosen during onboarding. Persisted on the account (source of truth)
  // and mirrored onto the org so it shows up in Configurações › Geral.
  const onboardingNiche = (formData.get('niche') as string)?.trim() || null

  if (!name || name.length < 2) {
    return { ok: false, error: 'Nome da organização inválido' }
  }

  const slug = await generateUniqueSlug(name)
  const admin = createAdminClient()

  // 0. Ensure the user has an account (top-level tenant grouping). Every org
  //    belongs to exactly one account; the niche lives on the account and is
  //    inherited by all its orgs. Reuse the user's existing account if any,
  //    otherwise create one (the user becomes its admin).
  let accountId: string | null = null
  let accountNiche: string | null = null
  {
    const { data: existing } = await admin
      .from('account_members')
      .select('account_id, accounts(niche)')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (existing?.account_id) {
      accountId    = existing.account_id
      accountNiche = (existing as any).accounts?.niche ?? null

      // Se a conta ainda não tem nicho definido e o onboarding informou um,
      // grava agora (1ª org da conta define o nicho herdado).
      if (!accountNiche && onboardingNiche) {
        await admin.from('accounts').update({ niche: onboardingNiche }).eq('id', accountId)
        accountNiche = onboardingNiche
      }

      // Hard cap: 1 organização por conta em TODOS os planos. A conta já
      // existe, então se já houver qualquer org vinculada, bloqueia a criação
      // de mais uma. Super-admins (operadores da plataforma) ficam isentos.
      const superAdmin = await isSuperAdmin()
      if (!superAdmin) {
        const { count } = await admin
          .from('organizations')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
        if ((count ?? 0) >= 1) {
          return {
            ok: false,
            error: 'Seu plano permite apenas uma organização. Você já possui uma organização ativa.',
          }
        }
      }
    } else {
      const { data: newAccount, error: accErr } = await admin
        .from('accounts')
        .insert({ name, owner_user_id: user.id, niche: onboardingNiche })
        .select('id, niche')
        .single()
      if (accErr) return { ok: false, error: accErr.message }
      accountId    = newAccount.id
      accountNiche = newAccount.niche
      await admin
        .from('account_members')
        .insert({ account_id: accountId, user_id: user.id, role: 'admin' })

      // Sem isso, `getAccountSubscription` (lib/plans/server.ts) não encontra
      // linha nenhuma pra essa conta e trata como Free (0 créditos de IA) —
      // o campo organizations.plan='trial' só alimenta o gate de congelamento
      // (isAccessBlocked), não o gate de feature/crédito de IA, que é
      // inteiramente baseado nesta tabela `subscriptions`. plan_id='pro'
      // replica a promessa de "acesso completo ao Pro" do trial.
      const trialEndsAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      await admin
        .from('subscriptions')
        .upsert({
          account_id: accountId,
          plan_id: 'pro',
          status: 'trialing',
          trial_ends_at: trialEndsAt,
          current_period_end: trialEndsAt,
        }, { onConflict: 'account_id' })
    }
  }

  // 1. Cria a organização (vinculada à conta + herdando o nicho da conta)
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name,
      slug,
      account_id: accountId,
      niche: accountNiche,            // mirror of the account niche
      // New signups start on a real 15-day trial with full Pro access, no card
      // required (matches the marketing site's "teste grátis por 15 dias").
      // If it lapses without a paid subscription, isAccessBlocked() flags the
      // org and the app layout freezes it to read-only (see app/app/[orgSlug]/layout.tsx).
      // subscription_status='trialing' (não 'active') — o cron de e-mails de
      // trial (lib/inngest/trial-emails.ts) pula orgs com status 'active' por
      // entender que já são assinantes pagos; 'trialing' é o valor correto
      // pra quem ainda não converteu (mesma convenção usada após checkout Asaas).
      plan: 'trial',
      account_type: 'self_signup',
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      // Limites amplos durante o trial (espelha o Pro) — ficam apertados só se
      // a conta congelar ou assinar um plano com teto menor (Starter).
      limit_leads: null,
      limit_whatsapp_monthly: null,
      limit_email_monthly: null,
      limit_users: 6,
      onboarding_completed: true,   // wizard is replaced by the onboarding flow
    })
    .select()
    .single()

  if (orgError) {
    return { ok: false, error: orgError.message }
  }

  // 2. Cria membership como owner
  const { error: memberError } = await admin
    .from('memberships')
    .insert({ organization_id: org.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    // Org criada mas membership falhou — tenta rollback
    await admin.from('organizations').delete().eq('id', org.id)
    return { ok: false, error: memberError.message }
  }

  // 2a. Fan-out: todo usuário já presente na conta deve existir nesta nova org
  //     também (regra: "todos os usuários presentes em todas as orgs da conta").
  //     A visibilidade por org é controlada depois via memberships.hidden.
  if (accountId) {
    const { data: accUsers } = await admin
      .from('account_members')
      .select('user_id, role')
      .eq('account_id', accountId)
    for (const au of accUsers ?? []) {
      if (au.user_id === user.id) continue // já é owner desta org
      await admin.from('memberships').upsert(
        {
          organization_id: org.id,
          user_id:         au.user_id,
          role:            au.role === 'admin' ? 'admin' : 'member',
          permissions:     au.role === 'admin' ? {} : defaultMemberPermissions(),
          hidden:          false,
        },
        { onConflict: 'organization_id,user_id', ignoreDuplicates: true },
      )
    }
  }

  // 2b. Referral capture (/signup?ref=CODE). The code is bridged via a cookie
  //     set on the signup page (covers the Google OAuth flow, where the ref
  //     param can't round-trip through the provider). Best-effort.
  if (accountId) {
    const { cookies } = await import('next/headers')
    const refCode = cookies().get('althos_ref')?.value?.trim()
    if (refCode) {
      const { error: refError } = await admin.rpc('redeem_referral', {
        p_referred_account_id: accountId,
        p_code:                refCode,
      })
      if (refError) console.error('createOrganization redeem_referral error:', refError.message)
      cookies().delete('althos_ref')
    }
  }

  // 3. Cria pipeline padrão + estágios
  const { data: pipeline } = await admin
    .from('pipelines')
    .insert({ organization_id: org.id, name: 'Vendas', is_default: true })
    .select()
    .single()

  if (pipeline) {
    await admin.from('pipeline_stages').insert([
      { pipeline_id: pipeline.id, name: 'Novo Lead',     position: 1, color: '#94a3b8' },
      { pipeline_id: pipeline.id, name: 'Contato Feito', position: 2, color: '#3b82f6' },
      { pipeline_id: pipeline.id, name: 'Negociação',    position: 3, color: '#eab308' },
      { pipeline_id: pipeline.id, name: 'Fechado',       position: 4, color: '#22c55e', is_won: true },
    ])
  }

  return { ok: true as const, data: org, redirectTo: `/app/${slug}` }
}

/**
 * Update org-level AI qualifier configuration (Bloco 2 — IA Nível 1).
 * The AI now runs on the platform's centralized token (env ANTHROPIC_API_KEY),
 * metered per account by the credit system — there is no per-org API key.
 */
export async function updateOrgAI(
  orgSlug: string,
  payload: {
    ai_enabled?: boolean
    ai_provider?: 'claude' | 'gemini'
    ai_qualifier_model?: string
    ai_qualifier_model_gemini?: string
    ai_qualifier_prompt?: string
    ai_business_context?: string
    ocr_provider?: 'claude' | 'gemini'
  },
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const updates: any = {}
  if (typeof payload.ai_enabled === 'boolean') updates.ai_enabled = payload.ai_enabled
  if (payload.ai_provider === 'claude' || payload.ai_provider === 'gemini')
    updates.ai_provider = payload.ai_provider
  // ai_qualifier_model é lido como o modelo Claude compartilhado por outras
  // features (copiloto, chat financeiro, social, funil, suporte — todas
  // presas à API da Anthropic). Só grava aqui quando o modelo informado é
  // mesmo um modelo Claude, pra nunca vazar um valor "gemini-*" pra essas
  // outras chamadas; o modelo Gemini do qualificador vive em coluna própria.
  if (payload.ai_qualifier_model && !payload.ai_qualifier_model.startsWith('gemini'))
    updates.ai_qualifier_model = payload.ai_qualifier_model
  if (payload.ai_qualifier_model_gemini) updates.ai_qualifier_model_gemini = payload.ai_qualifier_model_gemini
  if (typeof payload.ai_qualifier_prompt === 'string')
    updates.ai_qualifier_prompt = payload.ai_qualifier_prompt || DEFAULT_QUALIFIER_PROMPT
  if (typeof payload.ai_business_context === 'string')
    updates.ai_business_context = payload.ai_business_context
  if (payload.ocr_provider === 'claude' || payload.ocr_provider === 'gemini')
    updates.ocr_provider = payload.ocr_provider

  if (Object.keys(updates).length === 0) return { ok: true as const }

  const { error } = await supabase.from('organizations').update(updates).eq('id', org.id)
  if (error) {
    console.error('updateOrgAI error:', error)
    return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/configuracoes`)
  return { ok: true as const }
}

/**
 * Returns the AI config for the current org. The AI runs on the platform's
 * centralized token, so there is no per-org API key to read or expose.
 */
export async function getOrgAIConfig(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('organizations')
    .select('ai_enabled, ai_provider, ai_qualifier_model, ai_qualifier_model_gemini, ai_qualifier_prompt, ai_business_context, ocr_provider')
    .eq('id', org.id)
    .maybeSingle()

  return {
    ai_enabled: data?.ai_enabled ?? false,
    ocr_provider: (data?.ocr_provider === 'gemini' ? 'gemini' : 'claude') as 'claude' | 'gemini',
    ai_provider: data?.ai_provider ?? 'anthropic',
    ai_qualifier_model: data?.ai_qualifier_model ?? 'claude-haiku-4-5',
    ai_qualifier_model_gemini: data?.ai_qualifier_model_gemini ?? 'gemini-3.6-flash',
    ai_qualifier_prompt: data?.ai_qualifier_prompt ?? DEFAULT_QUALIFIER_PROMPT,
    ai_business_context: data?.ai_business_context ?? '',
  }
}

// ─── Onboarding setup ────────────────────────────────────────────────────────

export async function completeOrgSetup(
  orgSlug: string,
  data: {
    name:           string
    contact_email:  string
    contact_phone:  string
    niche:          string
    address_city:   string
    address_state:  string
    address_zip:    string
  },
) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { error } = await supabase
    .from('organizations')
    .update({ ...data, onboarding_completed: true })
    .eq('id', org.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}`, 'layout')
  return { ok: true as const }
}
