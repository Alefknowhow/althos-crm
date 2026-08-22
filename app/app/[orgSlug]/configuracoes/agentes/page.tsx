import { listAgentTokens } from '@/actions/agent-tokens'
import AgentTokensView from '@/components/features/agent/AgentTokensView'

export const dynamic = 'force-dynamic'

/**
 * Etapa 3 (Agent Layer) — gestão de Personal Access Tokens usados por
 * agentes de IA (Claude Code, Codex) pra se conectar ao Althos MCP Server
 * (app/api/mcp/route.ts). Sem chatbot — só uma tela de gestão de token.
 */
export default async function AgentesPage({ params }: { params: { orgSlug: string } }) {
  const tokens = await listAgentTokens(params.orgSlug)
  return <AgentTokensView orgSlug={params.orgSlug} tokens={tokens} />
}
