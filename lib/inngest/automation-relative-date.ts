/**
 * Trigger genérico de "data relativa" (issue #18, seção 4/5) — generaliza os
 * crons fixos de `automation-crons.ts` (embarque no dia exato, aniversário no
 * dia exato) num mecanismo configurável: N dias/semanas/meses antes|depois|no
 * momento de um campo de data de uma entidade suportada (ver
 * `lib/automations/relative-date-entities.ts`).
 *
 * Roda de hora em hora (não 1x/dia como os outros crons) porque o horário de
 * disparo (`timeOfDay`) é configurável por automação — precisa checar a cada
 * hora se "agora" bateu com o horário escolhido pelo usuário.
 *
 * Idempotência: `automation_date_fires` tem UNIQUE (automation_id, entity_id,
 * fire_date) — o insert falha silenciosamente (nós tratamos como "já
 * disparado hoje") se o cron rodar de novo na mesma hora/dia por retry do
 * Inngest, e nunca duplica o evento mesmo em replay.
 *
 * Reconciliação: como o cron reavalia a condição (data-base vs. hoje) toda
 * hora a partir do estado ATUAL da entidade — não de um agendamento
 * persistido —, se a data-base mudar depois de calculado um disparo futuro,
 * o próximo ciclo automaticamente para de bater (ou passa a bater num dia
 * diferente). Não há "job agendado" para cancelar.
 */

import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { RELATIVE_DATE_ENTITIES, DEFAULT_RELATIVE_DATE_CONFIG, type RelativeDateTriggerConfig } from '../automations/relative-date-entities'

const SP_TZ = 'America/Sao_Paulo'

function todayPartsInSP(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SP_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), hour: Number(get('hour')) }
}

/** Soma/subtrai dias/semanas/meses a uma data calendário (sem hora), sem
 *  depender de fuso — trabalha só em Y/M/D, então DST não afeta o resultado. */
function shiftDate(y: number, m: number, d: number, amount: number, unit: RelativeDateTriggerConfig['unit']): { y: number; m: number; d: number } {
  const date = new Date(Date.UTC(y, m - 1, d))
  if (unit === 'days') date.setUTCDate(date.getUTCDate() + amount)
  else if (unit === 'weeks') date.setUTCDate(date.getUTCDate() + amount * 7)
  else if (unit === 'months') date.setUTCMonth(date.getUTCMonth() + amount)
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

function ymdToString(p: { y: number; m: number; d: number }): string {
  return `${p.y.toString().padStart(4, '0')}-${p.m.toString().padStart(2, '0')}-${p.d.toString().padStart(2, '0')}`
}

/** Data-alvo que o campo da entidade precisa ter, dado "hoje" + config. */
function computeTargetDate(today: { y: number; m: number; d: number }, cfg: RelativeDateTriggerConfig): { y: number; m: number; d: number } {
  if (cfg.direction === 'on') return today
  // "N dias ANTES do embarque" disparado hoje → embarque = hoje + N.
  // "N dias DEPOIS do retorno" disparado hoje → retorno = hoje - N.
  const signedAmount = cfg.direction === 'before' ? cfg.amount : -cfg.amount
  return shiftDate(today.y, today.m, today.d, signedAmount, cfg.unit)
}

export const automationRelativeDateFn = inngest.createFunction(
  {
    id: 'automation-relative-date',
    name: 'Automação: data relativa (genérico)',
    retries: 1,
    triggers: [{ cron: '0 * * * *' }],
  },
  async ({ step }: { step: any }) => {
    const admin = createAdminClient()
    const now = new Date()
    const today = todayPartsInSP(now)

    const automations: Array<{
      id: string
      organization_id: string
      trigger_config: RelativeDateTriggerConfig
    }> = await step.run('fetch-relative-date-automations', async () => {
      const { data } = await admin
        .from('automations')
        .select('id, organization_id, trigger_config')
        .eq('trigger_type', 'date.relative')
        .eq('is_active', true)
      return data || []
    })

    if (automations.length === 0) return { fired: 0 }

    let totalFired = 0

    for (const auto of automations) {
      const cfg: RelativeDateTriggerConfig = { ...DEFAULT_RELATIVE_DATE_CONFIG, ...(auto.trigger_config || {}) }
      const meta = RELATIVE_DATE_ENTITIES.find(e => e.key === cfg.entity)
      if (!meta) continue

      // Só dispara na hora configurada (arredondada pra hora cheia, já que o
      // cron roda de hora em hora) — default 09:00 se não configurado.
      const configuredHour = Number((cfg.timeOfDay || '09:00').split(':')[0]) || 9
      if (today.hour !== configuredHour) continue

      const target = computeTargetDate(today, cfg)
      const targetStr = ymdToString(target)

      const matches: Array<{ id: string; contato_id: string | null }> = await step.run(
        `fetch-matches-${auto.id}`,
        async () => {
          const selectCols = Array.from(new Set(['id', meta.contatoColumn || 'id']))

          if (meta.recurringYearly) {
            // Aniversário-like: ignora o ano, compara só MM-DD.
            const { data } = await admin
              .from(meta.table)
              .select([...selectCols, meta.dateColumn].join(', '))
              .eq('organization_id', auto.organization_id)
              .not(meta.dateColumn, 'is', null)
              .limit(5000)
            const mm = targetStr.slice(5, 7)
            const dd = targetStr.slice(8, 10)
            return (data || [])
              .filter((r: any) => {
                const v = String(r[meta.dateColumn] || '')
                return v.slice(5, 7) === mm && v.slice(8, 10) === dd
              })
              .map((r: any) => ({ id: r.id, contato_id: meta.contatoColumn ? r[meta.contatoColumn] : r.id }))
          }

          let query = admin
            .from(meta.table)
            .select(selectCols.join(', '))
            .eq('organization_id', auto.organization_id)

          if (meta.columnType === 'date') {
            query = query.eq(meta.dateColumn, targetStr)
          } else {
            // timestamptz — janela [00:00, 24:00) do dia-alvo em horário de São Paulo.
            const startUTC = new Date(`${targetStr}T00:00:00-03:00`).toISOString()
            const nextDay = ymdToString(shiftDate(target.y, target.m, target.d, 1, 'days'))
            const endUTC = new Date(`${nextDay}T00:00:00-03:00`).toISOString()
            query = query.gte(meta.dateColumn, startUTC).lt(meta.dateColumn, endUTC)
          }
          // Tarefas concluídas/canceladas não devem mais disparar lembretes de vencimento.
          if (meta.table === 'tasks') query = query.eq('status', 'open')
          if (meta.table === 'travel_sales') query = query.neq('status', 'cancelled')

          const { data } = await query.limit(5000)
          return (data || []).map((r: any) => ({ id: r.id, contato_id: meta.contatoColumn ? r[meta.contatoColumn] : r.id }))
        }
      )

      for (const row of matches) {
        if (!row.contato_id) continue

        const fired = await step.run(`fire-${auto.id}-${row.id}`, async () => {
          // Trava de idempotência — se já disparamos essa (automação, registro,
          // dia), o insert falha por violação de UNIQUE e a gente ignora.
          const { error: dedupeError } = await admin.from('automation_date_fires').insert({
            organization_id: auto.organization_id,
            automation_id: auto.id,
            entity_id: row.id,
            fire_date: `${today.y.toString().padStart(4, '0')}-${today.m.toString().padStart(2, '0')}-${today.d.toString().padStart(2, '0')}`,
          })
          if (dedupeError) return false

          const { data: run, error } = await admin.from('automation_runs').insert({
            organization_id: auto.organization_id,
            automation_id: auto.id,
            contato_id: row.contato_id,
            status: 'running',
            current_step: 0,
            started_at: new Date().toISOString(),
            trigger_payload: { orgId: auto.organization_id, leadId: row.contato_id, entity: cfg.entity, entityId: row.id },
          }).select().single()

          if (error || !run) {
            throw new Error(`Falha ao criar automation_run (data relativa) ${auto.id}: ${error?.message}`)
          }

          await inngest.send({ name: 'automation.run.execute', data: { runId: run.id, orgId: auto.organization_id } })
          return true
        })

        if (fired) totalFired++
      }
    }

    return { fired: totalFired }
  }
)
