'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Upload, Settings, ChevronDown, RefreshCw, Filter, Check } from 'lucide-react'
import MetricPicker from './MetricPicker'
import AccountFilter from './AccountFilter'
import type { ObjectiveGroup } from '@/lib/marketing/objective'
import type { MetricKey } from './metricRegistry'
import { OBJECTIVE_FILTERS, type Account, type Campaign } from './MarketingOverviewShared'
import { PeriodTabs } from './MarketingOverviewControls'
import { NewAccountTrigger, NewCampaignTrigger, RecordSpendTrigger } from './MarketingOverviewTriggers'

export default function MarketingOverviewHeader({
  orgSlug,
  accounts,
  campaigns,
  metaLoginUserName,
  accountFilter,
  setAccountFilter,
  visibleCardMetrics,
  onChangeCardMetrics,
  visibleChartMetrics,
  onChangeChartMetrics,
  syncing,
  onResyncAccount,
  canResync,
  noAccountsYet,
  noCampaignsYet,
  objectiveFilter,
  setObjectiveFilter,
  onRefresh,
}: {
  orgSlug: string
  accounts: Account[]
  campaigns: Campaign[]
  metaLoginUserName?: string | null
  accountFilter: string | null
  setAccountFilter: (id: string | null) => void
  visibleCardMetrics: Set<MetricKey>
  onChangeCardMetrics: (next: Set<MetricKey>) => void
  visibleChartMetrics: Set<MetricKey>
  onChangeChartMetrics: (next: Set<MetricKey>) => void
  syncing: boolean
  onResyncAccount: () => void
  /** Sincronização automática só existe pra contas Meta — syncAdAccountCampaigns
   *  rejeita qualquer outro provider. Sem este gate, o botão aparecia (e
   *  sempre falhava) também nas contas Google/manuais reaproveitando este
   *  mesmo painel (issue #24). */
  canResync: boolean
  noAccountsYet: boolean
  noCampaignsYet: boolean
  objectiveFilter: ObjectiveGroup | 'all'
  setObjectiveFilter: (v: ObjectiveGroup | 'all') => void
  onRefresh: () => void
}) {
  const router = useRouter()

  return (
    <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pb-3 bg-background space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodTabs />
          {/* Badge 1: identidade do login do Facebook — "com qual conta da
              Meta o CRM está conectado", separado de qual conta de anúncio
              está sendo exibida agora (badge 2, o AccountFilter abaixo). */}
          {metaLoginUserName && (
            <button
              type="button"
              title="Ver/gerenciar login e contas conectadas"
              onClick={() => router.push(`/app/${orgSlug}/marketing/contas`)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              Conectado como <span className="font-medium text-foreground">{metaLoginUserName}</span>
            </button>
          )}
          {/* Badge 2: qual conta de anúncio está em exibição agora (só 1 por vez). */}
          <AccountFilter
            accounts={accounts}
            selected={accountFilter}
            onChange={setAccountFilter}
          />
          {/* Filtro por objetivo — mostra a métrica de conversão certa por
              tipo de campanha. Virou dropdown (era uma 2ª linha de pills)
              pra liberar espaço vertical e ficar junto dos outros filtros. */}
          {!noAccountsYet && !noCampaignsYet && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="font-medium">
                    {OBJECTIVE_FILTERS.find(f => f.value === objectiveFilter)?.label ?? 'Todos'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1">
                {OBJECTIVE_FILTERS.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setObjectiveFilter(f.value)}
                    className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="truncate">{f.label}</span>
                    {f.value === objectiveFilter && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          <MetricPicker
            visibleCardMetrics={visibleCardMetrics}
            onChangeCardMetrics={onChangeCardMetrics}
            visibleChartMetrics={visibleChartMetrics}
            onChangeChartMetrics={onChangeChartMetrics}
          />
          {accountFilter && canResync && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={syncing}
              onClick={onResyncAccount}
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', syncing && 'animate-spin')} /> Resincronizar
            </Button>
          )}
        </div>

        {/* Sem conta nenhuma, o banner abaixo já cobre o CTA de conectar —
            não duplica o botão aqui. Com conta conectada, vira "Gerenciar
            contas" (é mais que só "novo": inclui conectar mais contas,
            importar CSV etc.). */}
        {!noAccountsYet && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Settings className="w-4 h-4 mr-1.5" /> Gerenciar contas
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <NewCampaignTrigger orgSlug={orgSlug} accounts={accounts} onDone={onRefresh} variant="menu" />
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <RecordSpendTrigger
                  orgSlug={orgSlug}
                  campaigns={campaigns}
                  onDone={onRefresh}
                  variant="menu"
                />
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NewAccountTrigger orgSlug={orgSlug} onDone={onRefresh} variant="menu" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/app/${orgSlug}/marketing/importar`)}>
                <Upload className="w-4 h-4 mr-2" /> Importar CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/app/${orgSlug}/marketing/contas`)}
              >
                <Settings className="w-4 h-4 mr-2" /> Ver todas as contas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
