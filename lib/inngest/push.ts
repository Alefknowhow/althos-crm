/**
 * Inngest functions that send Web Push notifications.
 *
 * Two triggers:
 *  1. push-overdue-tasks — cron every hour, notifies assigned users of
 *     overdue open tasks (once per task, then marks push_notified_at).
 *  2. push-whatsapp-message — fires on whatsapp/message.received event,
 *     throttled to 1 push per org per 2 minutes.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser, sendPushToOrg } from '@/actions/push'

// ---------------------------------------------------------------------------
// 1. Hourly overdue-task push
// ---------------------------------------------------------------------------

export const pushOverdueTasksFn = inngest.createFunction(
  {
    id:      'push-overdue-tasks',
    name:    'Push: tarefas vencidas',
    retries: 1,
    triggers: [{ cron: '0 * * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()
    const now   = new Date().toISOString()

    const tasks: Array<{
      id: string
      title: string
      organization_id: string
      assigned_to: string
      due_date: string
    }> = await step.run('fetch-overdue-tasks', async () => {
      const { data } = await admin
        .from('tasks')
        .select('id, title, organization_id, assigned_to, due_date')
        .eq('status', 'open')
        .lt('due_date', now)
        .is('push_notified_at', null)
        .not('assigned_to', 'is', null)
        .limit(200)
      return data || []
    })

    if (tasks.length === 0) return { notified: 0 }

    // Group by assigned_to — one notification per user with a summary.
    const byUser = new Map<string, typeof tasks>()
    for (const t of tasks) {
      const list = byUser.get(t.assigned_to) || []
      list.push(t)
      byUser.set(t.assigned_to, list)
    }

    let totalSent = 0

    await step.run('send-pushes', async () => {
      const entries = Array.from(byUser.entries())
      for (const [userId, userTasks] of entries) {
        const count = userTasks.length
        const title = count === 1
          ? `Tarefa vencida: ${userTasks[0].title}`
          : `${count} tarefas vencidas`
        const body = count === 1
          ? `Venceu em ${new Date(userTasks[0].due_date).toLocaleDateString('pt-BR')}`
          : `Você tem ${count} tarefas abertas com prazo expirado.`

        const { data: org } = await admin
          .from('organizations')
          .select('slug')
          .eq('id', userTasks[0].organization_id)
          .single()

        const { sent } = await sendPushToUser(userId, {
          title,
          body,
          url:  org?.slug ? `/app/${org.slug}/tarefas` : '/',
          tag:  'overdue-tasks',
          icon: '/icon.svg',
        })
        totalSent += sent
      }
    })

    // Mark tasks as notified to avoid re-sending on next cron.
    await step.run('mark-notified', async () => {
      const ids = tasks.map((t: { id: string }) => t.id)
      await admin
        .from('tasks')
        .update({ push_notified_at: now })
        .in('id', ids)
    })

    return { notified: totalSent }
  },
)

// ---------------------------------------------------------------------------
// 2. New WhatsApp message push
// ---------------------------------------------------------------------------

export const pushWhatsappMessageFn = inngest.createFunction(
  {
    id:      'push-whatsapp-message',
    name:    'Push: nova mensagem WhatsApp',
    retries: 1,
    throttle: {
      key:    'event.data.orgId',
      limit:  1,
      period: '2m',
    },
    triggers: [{ event: 'whatsapp/message.received' }],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { orgId, contactName, messageBody } = event.data as {
      orgId:       string
      contactName: string
      messageBody: string | null
    }

    const admin = createAdminClient()

    const org: { slug: string } | null = await step.run('get-org-slug', async () => {
      const { data } = await admin
        .from('organizations')
        .select('slug')
        .eq('id', orgId)
        .single()
      return data
    })

    await step.run('send-push', async () => {
      const body = messageBody
        ? messageBody.length > 80 ? messageBody.slice(0, 80) + '…' : messageBody
        : 'Mensagem recebida no WhatsApp'

      await sendPushToOrg(orgId, {
        title: `Nova mensagem de ${contactName || 'contato'}`,
        body,
        url:   org?.slug ? `/app/${org.slug}/conversas` : '/',
        tag:   `whatsapp-${orgId}`,
        icon:  '/icon.svg',
      })
    })

    return { ok: true }
  },
)
