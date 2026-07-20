import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import LeadDetailActions from '@/components/features/LeadDetailActions'
import RequalifyButton from '@/components/features/ai/RequalifyButton'
import AIScoreBadge from '@/components/features/ai/AIScoreBadge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Wallet } from 'lucide-react'
import TaskCard from '@/components/features/TaskCard'
import TaskDialog from '@/components/features/TaskDialog'
import SendEmailDialog from '@/components/features/SendEmailDialog'
import CustomerProfileForm from '@/components/features/customers/CustomerProfileForm'
import CustomerDocuments from '@/components/features/customers/CustomerDocuments'
import ContatoRelationships from '@/components/features/contatos/ContatoRelationships'
import { listRelationships } from '@/actions/relationships'
import { listCreditsForContato } from '@/actions/travel-credits'
import { isTravelNiche } from '@/lib/niche'

const STATUS_META: Record<string, { label: string; className: string }> = {
  lead: { label: 'Lead', className: 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-900/20' },
  cliente: {
    label: 'Cliente',
    className: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20',
  },
  inativo: {
    label: 'Inativo',
    className: 'border-zinc-300 text-zinc-600 bg-zinc-50 dark:bg-zinc-800/40',
  },
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

export default async function ContatoDetailPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  const { data: lead } = await supabase
    .from('contatos')
    .select('*, pipeline_stages(name)')
    .eq('id', params.id)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!lead) notFound()

  const [
    { data: activities },
    { data: tasks },
    { data: emailSends },
    { data: templates },
    { data: defaultPipeline },
    { data: whatsappConv },
    { data: sales },
    { data: documents },
    relationships,
    travelCredits,
  ] = await Promise.all([
    supabase
      .from('contato_activities')
      .select('id, type, payload, created_at')
      .eq('contato_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, contato_id')
      .eq('contato_id', lead.id)
      .order('due_date', { ascending: true }),
    supabase
      .from('email_sends')
      .select('id, status, created_at, email_templates(name)')
      .eq('contato_id', lead.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('email_templates')
      .select('id, name, subject')
      .eq('organization_id', org.id)
      .order('name', { ascending: true }),
    supabase.from('pipelines').select('id').eq('organization_id', org.id).eq('is_default', true).maybeSingle(),
    supabase.from('whatsapp_conversations').select('*').eq('contato_id', lead.id).maybeSingle(),
    supabase
      .from('sales')
      .select('id, sale_date, amount_cents, status, payment_method, installments, products(name)')
      .eq('contato_id', lead.id)
      .eq('organization_id', org.id)
      .order('sale_date', { ascending: false }),
    supabase
      .from('contato_documents')
      .select('id, kind, file_path, file_name, file_size_bytes, mime_type, created_at')
      .eq('contato_id', lead.id)
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
    listRelationships(params.orgSlug, lead.id),
    isTravelNiche(org.niche) ? listCreditsForContato(params.orgSlug, lead.id) : Promise.resolve([]),
  ])

  const stagesRes = defaultPipeline
    ? await supabase
        .from('pipeline_stages')
        .select('id, name')
        .eq('pipeline_id', defaultPipeline.id)
        .order('position')
    : { data: [] as any[] }
  const stages = stagesRes.data || []

  const statusMeta = STATUS_META[lead.status] || STATUS_META.lead
  const totalPurchased = (sales || []).reduce(
    (a: number, s: any) => a + (s.amount_cents || 0),
    0,
  )

  return (
    <div className="space-y-6">
      <Link
        href={`/app/${params.orgSlug}/contatos`}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-3 h-3" /> Contatos
      </Link>

      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{lead.name}</h1>
            <Badge variant="outline" className={statusMeta.className}>
              {statusMeta.label}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-1 space-x-4">
            <span>{lead.email || 'Sem e-mail'}</span>
            <span>{lead.phone || 'Sem telefone'}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <AIScoreBadge score={lead.ai_score} tier={lead.ai_tier} summary={lead.ai_summary} />
          <Badge variant={lead.stage_id ? 'default' : 'outline'} className="text-sm px-3 py-1">
            {lead.stage_id
              ? stages.find(s => s.id === lead.stage_id)?.name || 'Estágio Atual'
              : 'Sem estágio'}
          </Badge>
          <RequalifyButton orgSlug={params.orgSlug} leadId={lead.id} />
          <SendEmailDialog orgSlug={params.orgSlug} lead={lead} templates={templates || []} org={org} />
          <LeadDetailActions lead={lead} orgSlug={params.orgSlug} stages={stages} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Cadastro (CPF, endereço, passaporte) */}
          <CustomerProfileForm orgSlug={params.orgSlug} leadId={lead.id} initial={lead} />

          {/* Documentos */}
          <CustomerDocuments
            orgSlug={params.orgSlug}
            leadId={lead.id}
            profileId={lead.id}
            initialDocuments={documents || []}
          />

          <Card>
            <CardHeader><CardTitle>Timeline de Atividades</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities?.map(act => (
                  <div key={act.id} className="flex gap-4 border-b pb-4 last:border-0 last:pb-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs">
                      {act.type === 'manual_created' ? '🚀' : act.type === 'note' ? '📝' : act.type === 'ai_qualified' ? '✨' : act.type.startsWith('email') ? '✉️' : act.type.startsWith('credit_') ? '🎫' : '⚙️'}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {act.type === 'manual_created' ? 'Contato criado manualmente' : act.type === 'note' ? 'Nota adicionada' : act.type === 'ai_qualified' ? `IA qualificou: ${act.payload?.tier?.toUpperCase()} (${act.payload?.score}/100)` : act.type === 'email_sent' ? 'E-mail enviado' : act.type === 'email_opened' ? 'E-mail aberto' : act.type === 'credit_created' ? `Crédito de viagem gerado: ${fmtCurrency(act.payload?.valor_cents || 0)} (${act.payload?.operadora})` : act.type === 'credit_used' ? `Crédito de viagem utilizado: ${fmtCurrency(act.payload?.valor_cents || 0)}` : act.type}
                      </div>
                      {act.type === 'note' && <div className="text-sm mt-1 whitespace-pre-wrap">{act.payload.text}</div>}
                      {act.type === 'ai_qualified' && (
                        <div className="text-sm mt-1 text-muted-foreground italic">
                          {act.payload?.reason}
                          {act.payload?.concerns?.length > 0 && (
                            <div className="mt-1 text-xs">⚠ {act.payload.concerns.join(' · ')}</div>
                          )}
                        </div>
                      )}
                      {act.type === 'email_sent' && <div className="text-sm mt-1 text-muted-foreground">Assunto: {act.payload.subject} (Template: {act.payload.template_name})</div>}
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(act.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tarefas</CardTitle>
              <TaskDialog orgSlug={params.orgSlug} defaultLead={{ id: lead.id, name: lead.name }} />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks && tasks.length > 0 ? tasks.map(task => (
                  <TaskCard key={task.id} task={task} orgSlug={params.orgSlug} />
                )) : (
                  <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">Nenhuma tarefa vinculada.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de E-mails</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {emailSends && emailSends.length > 0 ? emailSends.map(es => (
                  <div key={es.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="text-sm font-medium">{(Array.isArray(es.email_templates) ? es.email_templates[0]?.name : (es.email_templates as any)?.name) || 'Template Removido'}</div>
                      <div className="text-xs text-muted-foreground">{new Date(es.created_at).toLocaleString('pt-BR')}</div>
                    </div>
                    <div>
                      <Badge variant={es.status === 'sent' ? 'default' : es.status === 'opened' ? 'secondary' : es.status === 'failed' || es.status === 'bounced' ? 'destructive' : 'outline'}>{es.status}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">Nenhum e-mail enviado.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              {whatsappConv ? (
                <div className="space-y-4">
                  <div className="text-sm font-medium border rounded-none p-4 bg-muted/20 flex flex-col items-center justify-center text-center gap-2">
                    <div className="font-semibold">{whatsappConv.contact_name || whatsappConv.contact_phone}</div>
                    <div className="text-muted-foreground">{whatsappConv.contact_phone}</div>
                    <div className="text-xs mt-2 bg-primary/10 text-primary px-2 py-1 rounded-full">
                       Última interação: {new Date(whatsappConv.last_message_at).toLocaleDateString('pt-BR')} às {new Date(whatsappConv.last_message_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                    </div>
                  </div>
                  <Link href={`/app/${params.orgSlug}/conversas?id=${whatsappConv.id}`} className="flex w-full">
                    <Button className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white">Abrir Conversa WhatsApp</Button>
                  </Link>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                  <p className="mb-4">Este contato ainda não possui conversas registradas via WhatsApp Cloud API.</p>
                  <Button variant="outline" className="text-xs" disabled>Iniciar nova (em breve via HSM)</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Estágio Atual</span>
                <Badge>{lead.pipeline_stages?.name || '-'}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Valor</span>
                <div>{lead.value_cents ? `R$ ${(lead.value_cents / 100).toFixed(2)}` : '-'}</div>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Tags</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {lead.tags?.length ? lead.tags.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>) : '-'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parentesco */}
          <ContatoRelationships
            orgSlug={params.orgSlug}
            contatoId={lead.id}
            initial={relationships}
          />

          {/* Créditos de Viagem — só para agências de viagem, gerados via cancelamento de reserva */}
          {isTravelNiche(org.niche) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-primary" /> Créditos de Viagem
                </CardTitle>
                <span className="text-sm font-bold tabular-nums">
                  {fmtCurrency(travelCredits.reduce((a, c) => a + (c.status === 'available' ? c.valor_cents - c.valor_usado_cents : 0), 0))}
                </span>
              </CardHeader>
              <CardContent>
                {travelCredits.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sem créditos de viagem. Créditos são gerados automaticamente ao cancelar uma reserva.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {travelCredits.map(c => {
                      const saldo = c.valor_cents - c.valor_usado_cents
                      const statusLabel = c.status === 'used' ? 'Utilizado' : c.status === 'cancelled' ? 'Cancelado' : c.validade && new Date(c.validade) < new Date() ? 'Expirado' : 'Disponível'
                      return (
                        <div key={c.id} className="border-l-2 border-primary/30 pl-3 py-1 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{c.operadora}</span>
                            <span className="text-xs tabular-nums font-semibold">{fmtCurrency(saldo)}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{new Date(c.data_emissao).toLocaleDateString('pt-BR')}</span>
                            {c.validade && <span>· Válido até {new Date(c.validade).toLocaleDateString('pt-BR')}</span>}
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{statusLabel}</Badge>
                            {c.origem_sale_id && (
                              <Link href={`/app/${params.orgSlug}/reservas?venda=${c.origem_sale_id}`} className="text-primary hover:underline">
                                Ver venda de origem
                              </Link>
                            )}
                          </div>
                          {c.observacoes && (
                            <div className="text-xs text-muted-foreground mt-1">{c.observacoes}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Compras */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Compras</CardTitle>
              <span className="text-sm font-bold tabular-nums">{fmtCurrency(totalPurchased)}</span>
            </CardHeader>
            <CardContent>
              {(sales || []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sem vendas registradas.
                </p>
              ) : (
                <div className="space-y-3">
                  {(sales || []).map((s: any) => {
                    const product = Array.isArray(s.products) ? s.products[0] : s.products
                    return (
                      <div key={s.id} className="border-l-2 border-primary/30 pl-3 py-1 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{product?.name || 'Venda'}</span>
                          <span className="text-xs tabular-nums font-semibold">
                            {fmtCurrency(s.amount_cents)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{new Date(s.sale_date).toLocaleDateString('pt-BR')}</span>
                          {s.payment_method && <span>· {s.payment_method}</span>}
                          {(s.installments || 0) > 1 && <span>· {s.installments}x</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
