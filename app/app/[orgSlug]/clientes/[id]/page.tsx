import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getCustomer } from '@/actions/customers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink, Mail, Phone, Sparkles } from 'lucide-react'
import CustomerProfileForm from '@/components/features/customers/CustomerProfileForm'
import CustomerDocuments from '@/components/features/customers/CustomerDocuments'

export const dynamic = 'force-dynamic'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

const ACTIVITY_LABEL: Record<string, string> = {
  manual_created: 'Lead criado manualmente',
  note: 'Nota adicionada',
  stage_changed: 'Estágio alterado',
  email_sent: 'E-mail enviado',
  email_opened: 'E-mail aberto',
  ai_qualified: 'Qualificado pela IA',
  appointment_scheduled: 'Agendamento marcado',
  bulk_updated: 'Atualização em massa',
  form_submitted: 'Formulário enviado',
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const data = await getCustomer(params.orgSlug, params.id)
  if (!data || !data.lead) notFound()

  const { lead, profile, sales, activities, documents } = data
  const totalPurchased = (sales || []).reduce(
    (a: number, s: any) => a + (s.amount_cents || 0),
    0,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/app/${params.orgSlug}/clientes`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-3 h-3" /> Clientes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{lead.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              {lead.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {lead.email}
                </span>
              )}
              {lead.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {lead.phone}
                </span>
              )}
              {lead.ai_tier && (
                <Badge
                  variant="outline"
                  className={
                    lead.ai_tier === 'hot'
                      ? 'border-red-300 text-red-700 bg-red-50 dark:bg-red-900/20'
                      : lead.ai_tier === 'warm'
                        ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-900/20'
                  }
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {lead.ai_tier} · {lead.ai_score ?? 0}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs text-muted-foreground">Total comprado</div>
            <div className="text-2xl font-bold tabular-nums">{fmtCurrency(totalPurchased)}</div>
            <Link
              href={`/app/${params.orgSlug}/leads/${lead.id}`}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Ver lead completo <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Profile + Documents */}
        <div className="lg:col-span-2 space-y-6">
          <CustomerProfileForm
            orgSlug={params.orgSlug}
            leadId={lead.id}
            initial={profile}
          />

          <CustomerDocuments
            orgSlug={params.orgSlug}
            leadId={lead.id}
            profileId={profile?.id || null}
            initialDocuments={documents}
          />
        </div>

        {/* Right column — Sales + Activity */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Compras</CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sem vendas registradas.
                </p>
              ) : (
                <div className="space-y-3">
                  {sales.map((s: any) => {
                    const product = Array.isArray(s.products) ? s.products[0] : s.products
                    return (
                      <div
                        key={s.id}
                        className="border-l-2 border-primary/30 pl-3 py-1 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {product?.name || 'Venda'}
                          </span>
                          <span className="text-xs tabular-nums font-semibold">
                            {fmtCurrency(s.amount_cents)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{new Date(s.sale_date).toLocaleDateString('pt-BR')}</span>
                          {s.payment_method && <span>· {s.payment_method}</span>}
                          {(s.installments || 0) > 1 && <span>· {s.installments}x</span>}
                          {s.status !== 'completed' && (
                            <Badge variant="outline" className="text-[9px]">
                              {s.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Relacionamento</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sem atividades registradas.
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {activities.slice(0, 50).map((act: any) => (
                    <div
                      key={act.id}
                      className="text-xs border-b last:border-0 pb-1.5 last:pb-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {ACTIVITY_LABEL[act.type] || act.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(act.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {act.type === 'note' && act.payload?.text && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                          {act.payload.text}
                        </p>
                      )}
                      {act.type === 'ai_qualified' && act.payload?.reason && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {act.payload.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
