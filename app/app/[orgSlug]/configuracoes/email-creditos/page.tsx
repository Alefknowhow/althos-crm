import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getEmailCreditsStatusAction, listEmailCreditsLedger } from '@/actions/email-credits'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmailBuyCreditsButton } from '@/components/features/email/EmailBuyCreditsButton'

export const dynamic = 'force-dynamic'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TYPE_LABELS: Record<string, string> = {
  purchased: 'Compra de créditos', consumed: 'Envio de e-mail', refunded: 'Estorno',
}

export default async function EmailCreditosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const [statusRes, ledgerRes] = await Promise.all([
    getEmailCreditsStatusAction(params.orgSlug),
    listEmailCreditsLedger(params.orgSlug),
  ])
  const status = statusRes.ok ? statusRes.status : null
  const transactions = ledgerRes.ok ? ledgerRes.transactions : []

  return (
    <div className="space-y-6">
      <PageHeader title="Email Credits" hint="Saldo e histórico de disparos de e-mail cobrados por crédito." />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Saldo</CardTitle>
          <EmailBuyCreditsButton orgSlug={params.orgSlug} />
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Saldo disponível</div>
            <div className="text-2xl font-semibold">{formatCents(status?.availableCents ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Consumo este mês</div>
            <div className="text-lg font-medium">{formatCents(status?.usedCents ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Comprado este mês</div>
            <div className="text-lg font-medium">{formatCents(status?.purchasedCents ?? 0)}</div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-2">Histórico</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma transação ainda.</p>
        ) : (
          <div className="overflow-auto max-h-[500px] rounded-none border">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo após</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{TYPE_LABELS[t.type] || t.type}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(Number(t.althos_cost_cents))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(Number(t.balance_after_cents))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
