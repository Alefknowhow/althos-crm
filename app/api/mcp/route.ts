import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { resolveAgentContext, type AgentContext } from '@/lib/agent/context'
import { executeTool } from '@/lib/agent/execute'
import { TOOL_REGISTRY } from '@/lib/agent/tools/registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Etapa 3 (Agent Layer) — Althos MCP Server. Transporte Streamable HTTP
 * (stateless — sessionIdGenerator undefined, sem estado em memória entre
 * requests, compatível com ambiente serverless). Cada request cria um
 * McpServer novo, registra as tools do Tool Registry, e delega a
 * autenticação/autorização/auditoria pro Execution Engine — este arquivo
 * não decide permissão nenhuma, só resolve o token e conecta o transporte.
 */
function buildServer(ctx: AgentContext): McpServer {
  const server = new McpServer({ name: 'althos-mcp', version: '1.0.0' })

  for (const { tool, inputShape } of TOOL_REGISTRY) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: inputShape },
      async (args: any) => {
        const result = await executeTool(tool, ctx, args)
        if (!result.ok) {
          return { content: [{ type: 'text', text: `Erro: ${result.error}` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] }
      },
    )
  }

  return server
}

async function handleMcpRequest(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return new Response(JSON.stringify({ error: 'Token de agente ausente. Envie Authorization: Bearer <token>.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ctx = await resolveAgentContext(token)
  if (!ctx) {
    return new Response(JSON.stringify({ error: 'Token inválido ou revogado.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const server = buildServer(ctx)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)
  return transport.handleRequest(req)
}

export async function POST(req: Request) {
  return handleMcpRequest(req)
}

export async function GET(req: Request) {
  return handleMcpRequest(req)
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req)
}
