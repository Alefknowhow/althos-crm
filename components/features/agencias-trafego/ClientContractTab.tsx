'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileSignature, Wallet, Receipt } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import PlanoContratoManagerDialog from '@/components/features/agencias-trafego/PlanoContratoManagerDialog'
import ClientPortalAccessCard from '@/components/features/agencias-trafego/ClientPortalAccessCard'
import type { TrafficClientProfile } from '@/actions/traffic-client-profile'

type SaleRow = {
  id: string
  sale_date: string | null
  amount_cents: number | null
  status: string
  products: { name: string } | null
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  completed: { label: 'Concluída', className: 'bg-green-100 text-green-800 border-green-200' },
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  cancelled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
}

/** Contrato & Financeiro do cliente — representa a relação Agência↔Cliente
 *  (plan_contracts.contato_id), firmada assim que o contato vira cliente
 *  (ver createCustomer, actions/contatos-contactpoints.ts). Não tem
 *  relação com vendas: um cliente tem UM contrato com a agência,
 *  independente de quantas vendas/renovações aconteçam depois — "Vendas"
 *  aqui é só o histórico financeiro, informativo. Nunca o billing do SaaS
 *  Althos. */
export default function ClientContractTab({
  orgSlug, clientId, clientName, clientEmail, clientPhone, profile, sales,
}: {
  orgSlug: string
  clientId: string
  clientName: string
  clientEmail: string | null
  clientPhone: string | null
  profile: TrafficClientProfile | null
  sales: SaleRow[]
}) {
  const [contractOpen, setContractOpen] = useState(false)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4" /> Fee e orçamento</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Budget de mídia (mensal)</div>
            <div className="text-lg font-bold tabular-nums mt-1">
              {profile?.monthlyBudgetCents != null ? formatCurrency(profile.monthlyBudgetCents) : '—'}
            </div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Início do contrato</div>
            <div className="text-lg font-bold mt-1">
              {profile?.contractStart ? new Date(profile.contractStart + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2"><FileSignature className="w-4 h-4" /> Contrato</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setContractOpen(true)}>Gerenciar contrato</Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Relação Agência↔Cliente — firmada assim que {clientName} entrou como cliente, independente de vendas.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Receipt className="w-4 h-4" /> Vendas</CardTitle></CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada pra este cliente ainda.</p>
          ) : (
            <div className="divide-y">
              {sales.map(s => {
                const status = STATUS_LABEL[s.status] || STATUS_LABEL.completed
                return (
                  <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <div className="font-medium">{s.products?.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.sale_date ? new Date(s.sale_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-medium">{formatCurrency(s.amount_cents || 0)}</span>
                      <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ClientPortalAccessCard orgSlug={orgSlug} contatoId={clientId} />

      {contractOpen && (
        <PlanoContratoManagerDialog
          orgSlug={orgSlug}
          contatoId={clientId}
          clientName={clientName}
          clientEmail={clientEmail}
          clientPhone={clientPhone}
          open={contractOpen}
          onOpenChange={setContractOpen}
        />
      )}
    </div>
  )
}
