import {
  getClientsTool, getClientsShape,
  getClientTool, getClientShape,
  getClientPerformanceTool, getClientPerformanceShape,
  getClientTargetsTool,
} from '@/lib/agent/tools/clients'
import {
  getCampaignsTool, getCampaignsShape,
  getCampaignPerformanceTool, getCampaignPerformanceShape,
} from '@/lib/agent/tools/campaigns'
import {
  getTasksTool, getTasksShape,
  createTaskTool, createTaskShape,
} from '@/lib/agent/tools/tasks'
import type { ToolDef } from '@/lib/agent/execute'

/**
 * Etapa 3 (Agent Layer) — Tool Registry. Cada entrada pareia o ToolDef
 * (usado pelo Execution Engine) com o input shape zod (usado pelo MCP
 * server pra declarar o schema da ferramenta pro LLM).
 */
export const TOOL_REGISTRY: { tool: ToolDef<any>; inputShape: Record<string, any> }[] = [
  { tool: getClientsTool, inputShape: getClientsShape },
  { tool: getClientTool, inputShape: getClientShape },
  { tool: getClientPerformanceTool, inputShape: getClientPerformanceShape },
  { tool: getClientTargetsTool, inputShape: getClientShape },
  { tool: getCampaignsTool, inputShape: getCampaignsShape },
  { tool: getCampaignPerformanceTool, inputShape: getCampaignPerformanceShape },
  { tool: getTasksTool, inputShape: getTasksShape },
  { tool: createTaskTool, inputShape: createTaskShape },
]
