/**
 * Status de voo do módulo Embarques — 3x/dia (6h/12h/18h Brasília) só para
 * voos que embarcam nos próximos 7 dias (aeroportos e a AeroDataBox não têm
 * dados úteis além disso, e evita gastar cota de API à toa em prazo longo).
 *
 * Consulta a AeroDataBox (mesma integração de actions/flight-lookup.ts, só
 * que lendo status/horário revisado em vez de só o previsto), grava em
 * sale_flight_status, e avisa (notificação + e-mail) o vendedor da reserva
 * (travel_sales.created_by) e os donos da conta (memberships.role='owner')
 * quando o atraso passa de 15min ou o voo é cancelado/desviado — só quando
 * o atraso AUMENTOU desde o último aviso (last_notified_delay_minutes),
 * pra não reavisar a cada rodada do cron sobre o mesmo atraso já conhecido.
 */

import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import { resend, EMAIL_FROM } from '@/lib/resend'
import { createNotification } from '@/actions/notifications'
import { buildFlightDesignator, fetchFlightStatus } from '@/actions/flight-lookup'

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const DELAY_ALERT_THRESHOLD_MIN = 15

type SaleProductRow = {
  id: string
  organization_id: string
  sale_id: string
  data: Record<string, any>
  travel_sales: { id: string; contato_id: string | null; created_by: string | null; client_name: string | null; status: string } | null
}

export const flightStatusCronFn = inngest.createFunction(
  {
    id: 'flight-status-cron',
    name: 'Status de voo — Embarques (6h/12h/18h Brasília)',
    retries: 1,
    triggers: [{ cron: '0 9,15,21 * * *' }], // 9h/15h/21h UTC = 6h/12h/18h America/Sao_Paulo
  },
  async ({ step }: { step: any }) => {
    const key = process.env.AERODATABOX_KEY
    if (!key) return { checked: 0, notified: 0, skipped: 'AERODATABOX_KEY não configurada' }

    const admin = createAdminClient()

    const orgs: { id: string; slug: string }[] = await step.run('fetch-viagens-orgs', async () => {
      const { data } = await admin.from('organizations').select('id, slug').eq('niche', 'viagens')
      return (data ?? []) as { id: string; slug: string }[]
    })
    if (orgs.length === 0) return { checked: 0, notified: 0 }
    const orgIds = orgs.map(o => o.id)
    const slugByOrg = new Map(orgs.map(o => [o.id, o.slug]))

    const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() + 7)
    const limitISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(limitDate)

    const products: SaleProductRow[] = await step.run('fetch-flight-products', async () => {
      const { data, error } = await admin
        .from('sale_products')
        .select('id, organization_id, sale_id, data, travel_sales!inner(id, contato_id, created_by, client_name, status)')
        .eq('kind', 'aereo')
        .in('organization_id', orgIds)
        .neq('travel_sales.status', 'cancelled')
        .limit(5000)
      if (error) { console.error('[flight-status-cron] fetch-flight-products failed:', error); return [] }
      return (data ?? []) as unknown as SaleProductRow[]
    })

    // Monta {designator, flightDate} por produto, filtrando pra janela de 7
    // dias e descartando o que não tem dados suficientes pra consultar.
    type Candidate = { orgId: string; designator: string; flightDate: string; product: SaleProductRow }
    const candidates: Candidate[] = []
    for (const p of products) {
      const flightDate = String(p.data?.data || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) continue
      if (flightDate < todayISO || flightDate > limitISO) continue
      const designator = await buildFlightDesignator(p.data?.companhia || '', p.data?.numero_voo || '')
      if (!designator) continue
      candidates.push({ orgId: p.organization_id, designator, flightDate, product: p })
    }

    // Deduplica por (org, designador, data) — várias vendas podem citar o
    // mesmo voo físico; consulta a API só uma vez por voo único.
    const uniqueByKey = new Map<string, Candidate>()
    for (const c of candidates) {
      const key2 = `${c.orgId}|${c.designator}|${c.flightDate}`
      if (!uniqueByKey.has(key2)) uniqueByKey.set(key2, c)
    }

    let checked = 0
    let notified = 0

    // Cache de donos por org (evita reconsultar membership pra cada voo).
    const ownersByOrg = new Map<string, string[]>()
    async function getOwnerIds(orgId: string): Promise<string[]> {
      if (ownersByOrg.has(orgId)) return ownersByOrg.get(orgId)!
      const { data } = await admin.from('memberships').select('user_id').eq('organization_id', orgId).eq('role', 'owner')
      const ids = (data ?? []).map((m: any) => m.user_id as string)
      ownersByOrg.set(orgId, ids)
      return ids
    }

    const uniques = Array.from(uniqueByKey.values())
    for (let i = 0; i < uniques.length; i++) {
      const c = uniques[i]
      if (i > 0) await sleep(1100) // respeita o rate-limit por segundo do plano grátis/pro da AeroDataBox

      const result = await step.run(`check-flight-${c.orgId}-${c.designator}-${c.flightDate}`, async () => {
        const res = await fetchFlightStatus(c.designator, c.flightDate, key)
        checked++
        if (!res.ok) return null

        const { data: existing } = await admin
          .from('sale_flight_status')
          .select('id, last_notified_delay_minutes, status')
          .eq('organization_id', c.orgId)
          .eq('flight_designator', c.designator)
          .eq('flight_date', c.flightDate)
          .maybeSingle()

        const prevNotified = existing?.last_notified_delay_minutes ?? 0
        const worseningDelay = res.result.delay_minutes >= DELAY_ALERT_THRESHOLD_MIN && res.result.delay_minutes > prevNotified
        const newlyDisrupted = (res.result.status === 'cancelled' || res.result.status === 'diverted') && existing?.status !== res.result.status
        const shouldNotify = worseningDelay || newlyDisrupted

        await admin.from('sale_flight_status').upsert({
          organization_id: c.orgId,
          flight_designator: c.designator,
          flight_date: c.flightDate,
          status: res.result.status,
          scheduled_departure: res.result.scheduled_departure,
          revised_departure: res.result.revised_departure,
          delay_minutes: res.result.delay_minutes,
          last_notified_delay_minutes: shouldNotify ? res.result.delay_minutes : prevNotified,
          last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,flight_designator,flight_date' })

        return shouldNotify ? res.result : null
      })

      if (!result) continue

      // Todas as vendas dessa org que citam o mesmo voo — cada uma pode ter
      // um vendedor diferente.
      const affected = candidates.filter(x => x.orgId === c.orgId && x.designator === c.designator && x.flightDate === c.flightDate)
      const ownerIds = await getOwnerIds(c.orgId)

      for (const a of affected) {
        const sale = a.product.travel_sales
        if (!sale) continue
        const recipients = new Set<string>(ownerIds)
        if (sale.created_by) recipients.add(sale.created_by)
        if (recipients.size === 0) continue

        const label = result.status === 'cancelled' ? 'cancelado'
          : result.status === 'diverted' ? 'desviado'
          : `atrasado (${result.delay_minutes}min)`
        const title = `Voo ${c.designator} ${label}`
        const content = `Reserva de ${sale.client_name || 'cliente'} — voo ${c.designator} em ${c.flightDate}.`

        await step.run(`notify-${a.orgId}-${c.designator}-${sale.id}`, async () => {
          for (const userId of Array.from(recipients)) {
            await createNotification({
              organizationId: c.orgId,
              userId,
              type: 'flight_status_changed',
              title,
              content,
              link: `/app/${slugByOrg.get(c.orgId) || ''}/embarques`,
            })
          }

          const { data: profileRows } = await admin.from('profiles').select('id, email').in('id', Array.from(recipients))
          const emails = (profileRows ?? []).map((p: any) => p.email).filter(Boolean)
          if (emails.length > 0) {
            try {
              await resend.emails.send({
                from: EMAIL_FROM,
                to: emails,
                subject: title,
                html: `<p>${content}</p><p>Confira o embarque no painel do Althos CRM.</p>`,
              })
            } catch (err) {
              console.error('[flight-status-cron] email send failed:', err)
            }
          }
          notified++
        })
      }
    }

    return { checked, notified }
  }
)
