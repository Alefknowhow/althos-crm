/**
 * Saúde das integrações — desligado o probe automático em background
 * (2026-08-22, economia de custo Inngest). Ficava rodando 1 step POR ORG a
 * cada 15-30 min incondicionalmente, o que escala mal com nº de tenants
 * (era o maior risco de custo do painel de saúde a longo prazo — ver
 * auditoria de custo Inngest).
 *
 * A verificação agora é só sob demanda: botão "Verificar agora" na tela
 * Configurações → Integrações → Saúde, que chama
 * actions/health.ts::runHealthCheckNow diretamente (Server Action comum,
 * NÃO passa pelo Inngest, não conta pra cota de execuções).
 *
 * Trade-off: sem o probe periódico, o histórico/gráfico de uptime
 * (integration_health_checks) só ganha pontos novos quando alguém clica
 * "Verificar agora" — não é mais um monitoramento contínuo. Se no futuro
 * isso precisar voltar a rodar sozinho, a forma barata de fazer é reduzir
 * a query pra só orgs com pelo menos uma integração configurada (hoje
 * probe roda pra org nenhuma configurada também) antes de reativar a cron.
 *
 * Mantém só a limpeza diária (histórico >35 dias) — 1 execução/dia, custo
 * desprezível.
 */

import { inngest } from './client'
import { pruneHealthHistory } from '@/lib/health/run'

export const integrationHealthPruneFn = inngest.createFunction(
  {
    id: 'integration-health-prune',
    name: 'Saúde das integrações: limpeza',
    retries: 1,
    triggers: [{ cron: '0 3 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const cutoff = await step.run('prune', async () => pruneHealthHistory(35))
    return { cutoff }
  },
)
