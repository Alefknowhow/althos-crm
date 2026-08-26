/**
 * Resumo diário por e-mail — dados + HTML compartilhados entre o cron
 * (lib/inngest/daily-digest-cron.ts) e o preview (actions/digest.ts), pra
 * garantir que o que o usuário vê no botão "Pré-visualizar" seja
 * exatamente o que seria enviado.
 *
 * "Hoje" é sempre calculado no fuso de Brasília (America/Sao_Paulo),
 * independente do fuso do servidor — o cron dispara às 10:00 UTC (7h em
 * Brasília) e precisa que "hoje" bata com o dia que o dono da conta está
 * vendo aí.
 */

type SupabaseAny = { from: (table: string) => any }

export type DigestTask = {
  id: string
  title: string
  due_date: string | null
  priority: string
  leads: { id: string; name: string } | { id: string; name: string }[] | null
}

export type DigestTrip = {
  id: string
  sale_number: string | null
  client_name: string | null
  destination: string | null
  departure_date: string | null
  return_date: string | null
}

export type DigestData = {
  todayLabel: string
  overdueTasks: DigestTask[]
  todayTasks: DigestTask[]
  todayTrips: DigestTrip[]
  weekTrips: DigestTrip[]
}

/** YYYY-MM-DD no fuso de Brasília, sem depender do fuso do processo Node. */
export function todayInBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function buildDigestData(supabase: SupabaseAny, orgId: string): Promise<DigestData> {
  const today = todayInBrazil()
  const weekEnd = addDays(today, 6)

  const [tasksRes, tripsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, due_date, priority, leads:contatos(id, name)')
      .eq('organization_id', orgId)
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .lte('due_date', `${today}T23:59:59`)
      .order('due_date', { ascending: true })
      .limit(100),
    supabase
      .from('travel_sales')
      .select('id, sale_number, client_name, destination, departure_date, return_date')
      .eq('organization_id', orgId)
      .neq('status', 'cancelled')
      .gte('departure_date', today)
      .lte('departure_date', weekEnd)
      .order('departure_date', { ascending: true })
      .limit(200),
  ])

  const allDueTasks: DigestTask[] = tasksRes.data ?? []
  const overdueTasks = allDueTasks.filter(t => (t.due_date || '').slice(0, 10) < today)
  const todayTasks = allDueTasks.filter(t => (t.due_date || '').slice(0, 10) === today)

  const allTrips: DigestTrip[] = tripsRes.data ?? []
  const todayTrips = allTrips.filter(t => t.departure_date === today)
  const weekTrips = allTrips.filter(t => t.departure_date !== today)

  return {
    todayLabel: new Date(`${today}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
    overdueTasks,
    todayTasks,
    todayTrips,
    weekTrips,
  }
}

function leadName(leads: DigestTask['leads']): string | null {
  if (!leads) return null
  const l = Array.isArray(leads) ? leads[0] : leads
  return l?.name || null
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtTaskDue(d: string | null): string {
  if (!d) return ''
  const hasTime = d.length > 10 && !d.endsWith('T00:00:00') && !d.endsWith('T00:00:00.000Z')
  const date = new Date(d)
  return hasTime ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
}

const PRIORITY_COLOR: Record<string, string> = { high: '#DC2626', normal: '#D97706', low: '#059669' }
const PRIORITY_LABEL: Record<string, string> = { high: 'Alta', normal: 'Média', low: 'Baixa' }

function taskRow(t: DigestTask, tone: 'overdue' | 'today'): string {
  const color = tone === 'overdue' ? '#DC2626' : '#1D1D1F'
  const bg = tone === 'overdue' ? '#FEF2F2' : '#F5F5F7'
  const name = leadName(t.leads)
  const time = fmtTaskDue(t.due_date)
  return `
    <tr>
      <td style="padding:10px 14px;background:${bg};border-radius:10px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <p style="margin:0;font-size:14px;font-weight:600;color:${color};">${escapeHtml(t.title)}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#6E6E73;">
              ${name ? `${escapeHtml(name)}${time ? ' · ' : ''}` : ''}${time ? `${time}` : ''}
            </p>
          </td>
          <td align="right" style="white-space:nowrap;">
            <span style="display:inline-block;background:${PRIORITY_COLOR[t.priority] || '#6E6E73'};color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;padding:3px 8px;border-radius:100px;">
              ${PRIORITY_LABEL[t.priority] || t.priority}
            </span>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr><td style="height:8px;"></td></tr>`
}

function tripRow(t: DigestTrip): string {
  return `
    <tr>
      <td style="padding:10px 14px;background:#F5F5F7;border-radius:10px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <p style="margin:0;font-size:14px;font-weight:600;color:#1D1D1F;">${escapeHtml(t.client_name || 'Cliente')}</p>
            <p style="margin:2px 0 0;font-size:12px;color:#6E6E73;">${escapeHtml(t.destination || '—')}${t.sale_number ? ` · #${escapeHtml(t.sale_number)}` : ''}</p>
          </td>
          <td align="right" style="white-space:nowrap;">
            <span style="font-size:13px;font-weight:600;color:#1D63FF;">${fmtDate(t.departure_date)}</span>
            ${t.return_date ? `<span style="display:block;font-size:11px;color:#6E6E73;">volta ${fmtDate(t.return_date)}</span>` : ''}
          </td>
        </tr></table>
      </td>
    </tr>
    <tr><td style="height:8px;"></td></tr>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function section(title: string, emoji: string, count: number, rows: string, emptyLabel: string): string {
  return `
    <tr><td style="padding:28px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><p style="margin:0;font-size:15px;font-weight:700;color:#1D1D1F;">${emoji} ${title}</p></td>
        <td align="right"><span style="font-size:12px;font-weight:700;color:#6E6E73;background:#F5F5F7;padding:3px 10px;border-radius:100px;">${count}</span></td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
        ${rows || `<tr><td style="padding:14px;text-align:center;font-size:13px;color:#9CA3AF;background:#FAFAFA;border-radius:10px;">${emptyLabel}</td></tr>`}
      </table>
    </td></tr>`
}

export function buildDigestHtml(orgName: string, orgSlug: string, data: DigestData): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Resumo diário — ${escapeHtml(orgName)}</title></head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:#1D1D1F;padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Althos CRM</span></td>
            <td align="right"><span style="font-size:12px;color:#9CA3AF;">${escapeHtml(orgName)}</span></td>
          </tr></table>
        </td></tr>

        <!-- Título -->
        <tr><td style="padding:32px 32px 0;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#1D1D1F;letter-spacing:-0.4px;text-transform:capitalize;">
            Bom dia! ☀️ Seu resumo de ${escapeHtml(data.todayLabel)}
          </h1>
          <p style="margin:6px 0 0;font-size:14px;color:#6E6E73;">O que precisa da sua atenção hoje.</p>
        </td></tr>

        ${section('Tarefas em atraso', '⚠️', data.overdueTasks.length, data.overdueTasks.map(t => taskRow(t, 'overdue')).join(''), 'Nenhuma tarefa atrasada — tudo em dia.')}
        ${section('Tarefas de hoje', '✅', data.todayTasks.length, data.todayTasks.map(t => taskRow(t, 'today')).join(''), 'Nenhuma tarefa prevista pra hoje.')}
        ${section('Embarques de hoje', '✈️', data.todayTrips.length, data.todayTrips.map(tripRow).join(''), 'Nenhum embarque hoje.')}
        ${section('Embarques da semana', '🗓️', data.weekTrips.length, data.weekTrips.map(tripRow).join(''), 'Nenhum outro embarque nos próximos 7 dias.')}

        <!-- CTA -->
        <tr><td style="padding:32px;">
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${appUrl}/app/${orgSlug}/tarefas" style="display:inline-block;background:#1D1D1F;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:100px;font-size:14px;font-weight:600;">
              Abrir o CRM →
            </a>
          </td></tr></table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(0,0,0,0.06);background:#F5F5F7;">
          <p style="margin:0;font-size:12px;color:#6E6E73;line-height:1.6;">
            Resumo diário automático · Desative em Configurações → Notificações · <a href="mailto:suporte@althoscrm.com.br" style="color:#6E6E73;">suporte@althoscrm.com.br</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
