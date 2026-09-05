'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import CustomerProfileForm from '@/components/features/customers/CustomerProfileForm'
import { NpsSection } from '@/components/features/contatos/NpsSection'
import ContatoRelationships from '@/components/features/contatos/ContatoRelationships'
import PropertyInterestsSection from '@/components/features/properties/PropertyInterestsSection'
import PropertyVisitsSection from '@/components/features/properties/PropertyVisitsSection'
import PropertyPreferencesCard from '@/components/features/properties/PropertyPreferencesCard'
import PropertyMatchSuggestions from '@/components/features/properties/PropertyMatchSuggestions'
import type { ContatoDeal } from '@/actions/contatos'
import type { TravelCreditRow } from '@/actions/travel-credits'
import { fmtCurrency, fmtDate, type Selected } from './ContatosViewShared'
import { DealCard } from './ContatosViewDetailHelpers'

export function OverviewTab({
  orgSlug, selected, c, isTravel, isRealEstate, properties, members,
  dadosEditRequested, deals, credits, onShowAllDeals,
}: {
  orgSlug:            string
  selected:           NonNullable<Selected>
  c:                  NonNullable<Selected>['contato']
  isTravel:           boolean
  isRealEstate?:      boolean
  properties:         { id: string; title: string; code: string | null }[]
  members:            { id: string; name: string }[]
  dadosEditRequested: boolean
  deals:              ContatoDeal[]
  credits:            TravelCreditRow[]
  onShowAllDeals:     () => void
}) {
  return (
    <>
      {/* Cadastro do Cliente — incorporado à Visão geral, no topo da aba */}
      <CustomerProfileForm
        orgSlug={orgSlug}
        leadId={c.id}
        initial={c}
        initialContactPoints={selected.contactPoints}
        initialDocuments={selected.documents}
        initialEditMode={dadosEditRequested}
      />

      {/* NPS — só faz sentido pós-venda */}
      {c.status === 'cliente' && (
        <NpsSection
          orgSlug={orgSlug}
          leadId={c.id}
          phone={c.phone}
          npsScore={c.nps_score ?? null}
          npsStatus={c.nps_status ?? null}
          npsSentAt={c.nps_sent_at ?? null}
          npsRespondedAt={c.nps_responded_at ?? null}
        />
      )}

      {/* Parentesco */}
      <ContatoRelationships orgSlug={orgSlug} contatoId={c.id} initial={selected.relationships} />

      {/* Negociações (resumo) */}
      {deals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Negociações
            </p>
            {deals.length > 2 && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={onShowAllDeals}>
                ver todas
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {deals.slice(0, 2).map(d => <DealCard key={d.id} d={d} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />)}
          </div>
        </div>
      )}

      {/* Créditos de Cancelamento (Viagens) — resumo já vira card na linha
          de topo; aqui só o detalhamento por crédito, quando existir. */}
      {isTravel && credits.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Detalhamento dos créditos
          </p>
          <div className="space-y-1.5">
            {credits.map(cr => {
                const saldo = cr.valor_cents - cr.valor_usado_cents
                const statusLabel = cr.status === 'used' ? 'Utilizado' : cr.status === 'cancelled' ? 'Cancelado' : cr.validade && new Date(cr.validade) < new Date() ? 'Expirado' : 'Disponível'
                return (
                  <div key={cr.id} className="border rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{cr.operadora}</span>
                      <span className="font-semibold tabular-nums">{fmtCurrency(saldo)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{fmtDate(cr.data_emissao)}</span>
                      {cr.validade && <span>· Válido até {fmtDate(cr.validade)}</span>}
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{statusLabel}</Badge>
                      {cr.origem_sale_id && (
                        <Link href={`/app/${orgSlug}/reservas?sale=${cr.origem_sale_id}`} className="text-primary hover:underline">
                          Ver venda de origem
                        </Link>
                      )}
                    </div>
                    {cr.observacoes && <div className="text-xs text-muted-foreground mt-1">{cr.observacoes}</div>}
                  </div>
                )
              })}
            </div>
        </div>
      )}

      {/* Imóveis de interesse / Visitas — só nicho imobiliário */}
      {isRealEstate && (
        <>
          <PropertyInterestsSection orgSlug={orgSlug} mode={{ type: 'contato', contatoId: c.id }} initial={selected.propertyInterests || []} properties={properties} />
          <PropertyVisitsSection orgSlug={orgSlug} mode={{ type: 'contato', contatoId: c.id }} initial={selected.propertyVisits || []} properties={properties} members={members.map(m => ({ user_id: m.id, name: m.name }))} />
          <PropertyPreferencesCard orgSlug={orgSlug} contatoId={c.id} initial={selected.propertyPreferences || null} />
          <PropertyMatchSuggestions orgSlug={orgSlug} contatoId={c.id} />
        </>
      )}
    </>
  )
}
