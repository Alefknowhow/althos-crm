/**
 * Inngest cron functions for trial lifecycle emails.
 *
 *  1. trial-expiry-warning  — daily at 09:00, finds orgs whose trial ends in
 *     exactly 3 days and sends a "seu trial expira em breve" warning email.
 *
 *  2. trial-expired-notify  — daily at 09:05, finds orgs whose trial expired
 *     yesterday or today and sends a "seu trial expirou" email with a CTA to
 *     subscribe.
 *
 * Both functions skip orgs that:
 *   - are already on a paid plan (subscription_status = 'active')
 *   - have billing_managed_externally = true
 *   - already received the same email (tracked via billing_email_log column;
 *     we use a simple boolean flag on the org row to avoid duplicate sends)
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { resend, EMAIL_FROM } from '@/lib/resend'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trialWarningHtml(orgName: string, daysLeft: number, orgSlug: string): string {
  const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/app/${orgSlug}/upgrade`
  const dayWord = daysLeft === 1 ? 'dia' : 'dias'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Seu trial expira em ${daysLeft} ${dayWord}</title></head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:#1D1D1F;padding:28px 32px;">
          <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Althos CRM</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1D1D1F;letter-spacing:-0.4px;">
            Seu trial expira em ${daysLeft} ${dayWord} ⏰
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6E6E73;line-height:1.6;">
            Olá! O trial gratuito de <strong style="color:#1D1D1F;">${orgName}</strong> no Althos CRM expira em <strong style="color:#1D1D1F;">${daysLeft} ${dayWord}</strong>.<br><br>
            Para continuar com acesso ao pipeline, leads e automações, assine um plano antes que o prazo encerre.
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${upgradeUrl}" style="display:inline-block;background:#1D1D1F;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:100px;font-size:15px;font-weight:600;">
              Escolher meu plano →
            </a>
          </td></tr></table>

          <!-- Plan summary -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;">
            <tr style="background:#F5F5F7;">
              <td style="padding:12px 16px;font-size:11px;font-weight:700;color:#6E6E73;text-transform:uppercase;letter-spacing:0.5px;">Plano</td>
              <td style="padding:12px 16px;font-size:11px;font-weight:700;color:#6E6E73;text-transform:uppercase;letter-spacing:0.5px;">Valor</td>
              <td style="padding:12px 16px;font-size:11px;font-weight:700;color:#6E6E73;text-transform:uppercase;letter-spacing:0.5px;">Destaque</td>
            </tr>
            <tr style="border-top:1px solid rgba(0,0,0,0.06);">
              <td style="padding:14px 16px;font-size:14px;font-weight:600;color:#1D1D1F;">Starter</td>
              <td style="padding:14px 16px;font-size:14px;color:#1D1D1F;">R$ 197/mês</td>
              <td style="padding:14px 16px;font-size:13px;color:#6E6E73;">Até 500 leads + Automações</td>
            </tr>
            <tr style="border-top:1px solid rgba(0,0,0,0.06);">
              <td style="padding:14px 16px;font-size:14px;font-weight:600;color:#1D1D1F;">Pro</td>
              <td style="padding:14px 16px;font-size:14px;color:#1D1D1F;">R$ 397/mês</td>
              <td style="padding:14px 16px;font-size:13px;color:#6E6E73;">Leads ilimitados + IA completa</td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#6E6E73;line-height:1.5;">
            Pagamento via <strong>PIX ou Cartão</strong> · Sem fidelidade · Cancele quando quiser.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(0,0,0,0.06);background:#F5F5F7;">
          <p style="margin:0;font-size:12px;color:#6E6E73;line-height:1.6;">
            Althos Performance · <a href="mailto:suporte@althoscrm.com.br" style="color:#6E6E73;">suporte@althoscrm.com.br</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function trialExpiredHtml(orgName: string, orgSlug: string): string {
  const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/app/${orgSlug}/upgrade`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Seu trial expirou</title></head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:#1D1D1F;padding:28px 32px;">
          <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Althos CRM</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px;">
          <div style="display:inline-block;background:#FEF3C7;color:#92400E;border-radius:100px;padding:6px 14px;font-size:13px;font-weight:600;margin-bottom:20px;">
            Trial expirado
          </div>
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1D1D1F;letter-spacing:-0.4px;">
            Seu trial de 15 dias encerrou
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6E6E73;line-height:1.6;">
            O período gratuito de <strong style="color:#1D1D1F;">${orgName}</strong> chegou ao fim.<br><br>
            Seus dados estão preservados. Assine um plano para recuperar acesso imediatamente ao pipeline, leads, WhatsApp e todas as funcionalidades.
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${upgradeUrl}" style="display:inline-block;background:#1D1D1F;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:100px;font-size:15px;font-weight:600;">
              Reativar minha conta →
            </a>
          </td></tr></table>

          <p style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#1D1D1F;">O que você não perde:</p>
          <ul style="margin:0 0 24px;padding-left:20px;">
            <li style="font-size:14px;color:#6E6E73;margin-bottom:6px;">Todos os leads e histórico do pipeline</li>
            <li style="font-size:14px;color:#6E6E73;margin-bottom:6px;">Templates de e-mail e formulários configurados</li>
            <li style="font-size:14px;color:#6E6E73;margin-bottom:6px;">Automações criadas</li>
            <li style="font-size:14px;color:#6E6E73;">Histórico de conversas do WhatsApp</li>
          </ul>

          <p style="margin:0;font-size:13px;color:#6E6E73;line-height:1.5;">
            Os dados ficam disponíveis por <strong>30 dias</strong> após o fim do trial.
            Pagamento via PIX ou Cartão · Sem fidelidade.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(0,0,0,0.06);background:#F5F5F7;">
          <p style="margin:0;font-size:12px;color:#6E6E73;line-height:1.6;">
            Althos Performance · <a href="mailto:suporte@althoscrm.com.br" style="color:#6E6E73;">suporte@althoscrm.com.br</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Type for org + owner query result
// ---------------------------------------------------------------------------

interface OrgWithOwner {
  id:              string
  name:            string
  slug:            string
  trial_ends_at:   string
  trial_warning_sent_at: string | null
  trial_expired_sent_at: string | null
  memberships: Array<{
    profiles: { email: string } | null
    role:     string
  }>
}

// ---------------------------------------------------------------------------
// 1. Trial warning — 3 days before expiry
// ---------------------------------------------------------------------------

export const trialWarningEmailFn = inngest.createFunction(
  {
    id:      'trial-warning-email',
    name:    'Trial: e-mail de aviso (D-3)',
    retries: 2,
    triggers: [{ cron: '0 9 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    // Window: orgs whose trial ends between 2d 23h and 3d 23h from now.
    // This gives us a 24-hour window so the daily cron doesn't miss anyone.
    const now = new Date()
    const windowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) // now + 2 days
    const windowEnd   = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000) // now + 4 days

    const orgs: OrgWithOwner[] = await step.run('fetch-trial-warning-orgs', async () => {
      const { data } = await admin
        .from('organizations')
        .select(`
          id, name, slug, trial_ends_at,
          trial_warning_sent_at, trial_expired_sent_at,
          memberships(role, profiles(email))
        `)
        .in('plan', ['trial', 'free_trial'])
        .neq('subscription_status', 'active')
        .is('billing_managed_externally', false)
        .is('trial_warning_sent_at', null)       // not yet warned
        .gte('trial_ends_at', windowStart.toISOString())
        .lt('trial_ends_at', windowEnd.toISOString())
        .limit(100)
      return (data as unknown as OrgWithOwner[]) ?? []
    })

    let sent = 0

    for (const org of orgs) {
      const ownerMembership = org.memberships.find(m => m.role === 'owner' || m.role === 'admin')
      const email = ownerMembership?.profiles?.email
      if (!email) continue

      const trialEnd  = new Date(org.trial_ends_at)
      const diffMs    = trialEnd.getTime() - now.getTime()
      const daysLeft  = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))

      await step.run(`send-warning-${org.id}`, async () => {
        try {
          await resend.emails.send({
            from:    EMAIL_FROM,
            to:      email,
            subject: `⏰ Seu trial expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} — ${org.name}`,
            html:    trialWarningHtml(org.name, daysLeft, org.slug),
          })

          // Mark as sent so we don't send twice
          await admin
            .from('organizations')
            .update({ trial_warning_sent_at: new Date().toISOString() })
            .eq('id', org.id)

          sent++
        } catch (err) {
          console.error(`[trial-warning] failed for org ${org.id}:`, err)
        }
      })
    }

    return { sent, checked: orgs.length }
  }
)

// ---------------------------------------------------------------------------
// 2. Trial expired — day of/after expiry
// ---------------------------------------------------------------------------

export const trialExpiredEmailFn = inngest.createFunction(
  {
    id:      'trial-expired-email',
    name:    'Trial: e-mail de expiração (D+0)',
    retries: 2,
    triggers: [{ cron: '5 9 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()

    const now = new Date()
    // Window: expired in the last 25 hours (generous to avoid missing with clock drift)
    const window25h = new Date(now.getTime() - 25 * 60 * 60 * 1000)

    const orgs: OrgWithOwner[] = await step.run('fetch-expired-orgs', async () => {
      const { data } = await admin
        .from('organizations')
        .select(`
          id, name, slug, trial_ends_at,
          trial_warning_sent_at, trial_expired_sent_at,
          memberships(role, profiles(email))
        `)
        .in('plan', ['trial', 'free_trial'])
        .neq('subscription_status', 'active')
        .is('billing_managed_externally', false)
        .is('trial_expired_sent_at', null)        // not yet notified
        .lt('trial_ends_at', now.toISOString())   // already expired
        .gte('trial_ends_at', window25h.toISOString()) // expired recently (last 25h)
        .limit(100)
      return (data as unknown as OrgWithOwner[]) ?? []
    })

    let sent = 0

    for (const org of orgs) {
      const ownerMembership = org.memberships.find(m => m.role === 'owner' || m.role === 'admin')
      const email = ownerMembership?.profiles?.email
      if (!email) continue

      await step.run(`send-expired-${org.id}`, async () => {
        try {
          await resend.emails.send({
            from:    EMAIL_FROM,
            to:      email,
            subject: `Seu trial expirou — reative o ${org.name} no Althos CRM`,
            html:    trialExpiredHtml(org.name, org.slug),
          })

          await admin
            .from('organizations')
            .update({ trial_expired_sent_at: new Date().toISOString() })
            .eq('id', org.id)

          sent++
        } catch (err) {
          console.error(`[trial-expired] failed for org ${org.id}:`, err)
        }
      })
    }

    return { sent, checked: orgs.length }
  }
)
