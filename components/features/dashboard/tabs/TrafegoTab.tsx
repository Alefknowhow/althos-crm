import { getTrafegoDashboardMetrics } from '@/actions/dashboard-trafego'
import KpiCard from '../KpiCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

/** Aba "Tráfego" — só renderizada quando o nicho da org é Agências de
 *  Tráfego (ver isModuleEnabled/isTrafficNiche no page.tsx). Etapa 2,
 *  Fase C: só métricas com dado real hoje (receita/vendas/clientes/leads)
 *  — MRR/churn/investimento em mídia/ROAS/margem/meta-por-cliente não têm
 *  fonte de dado no projeto ainda, então aparecem como estado vazio
 *  explicado em vez de número inventado. */
export default async function TrafegoTab({ orgSlug }: { orgSlug: string }) {
  const m = await getTrafegoDashboardMetrics(orgSlug)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <KpiCard
          label="Receita (30d)"
          value={fmtCurrency(m.revenueCents)}
          help="Soma das vendas concluídas nos últimos 30 dias."
        />
        <KpiCard
          label="Vendas (30d)"
          value={`${m.salesCount}`}
          help="Número de vendas concluídas nos últimos 30 dias."
        />
        <KpiCard
          label="Clientes ativos"
          value={`${m.activeClients}`}
          help="Contatos com status 'cliente' no momento."
        />
        <KpiCard
          label="Novos clientes (30d)"
          value={`${m.newClients}`}
          help="Contatos que viraram cliente nos últimos 30 dias."
        />
        <KpiCard
          label="Leads gerados (30d)"
          value={`${m.leadsGenerated}`}
          help="Novos contatos criados nos últimos 30 dias."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        <KpiCard
          label="MRR"
          value="—"
          help="Depende de um conceito de contrato recorrente por cliente, ainda não modelado no CRM."
        />
        <KpiCard
          label="Investimento em mídia"
          value="—"
          help="Depende do módulo Tráfego (conexão com Meta/Google Ads), ainda não conectado."
        />
        <KpiCard
          label="ROAS"
          value="—"
          help="Depende do investimento em mídia (módulo Tráfego) para ser calculado."
        />
        <KpiCard
          label="Margem"
          value="—"
          help="Depende de custos por cliente, ainda não modelados no Financeiro desta vertical."
        />
        <KpiCard
          label="Clientes abaixo da meta"
          value="—"
          help="Depende de metas configuráveis por cliente, ainda não existentes no sistema."
        />
        <KpiCard
          label="Churn"
          value="—"
          help="Depende de um histórico de cancelamento de contrato por cliente, ainda não modelado."
        />
      </div>
    </div>
  )
}
