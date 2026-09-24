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
import { buildModuleTools } from '@/lib/agent/tools/crud'
import { CRM_MODULES } from '@/lib/agent/tools/modules-crm'
import { VIAGENS_MODULES } from '@/lib/agent/tools/modules-viagens'
import { CLINICAS_IMOVEIS_MODULES } from '@/lib/agent/tools/modules-clinicas-imoveis'
import { SEGUROS_TRAFEGO_MODULES } from '@/lib/agent/tools/modules-seguros-trafego'
import { AGENDA_MODULES } from '@/lib/agent/tools/modules-agenda'
import {
  listProjectTemplatesTool, listProjectTemplatesShape,
  applyProjectTemplateTool, applyProjectTemplateShape,
} from '@/lib/agent/tools/project-templates'
import { createProjetoTool, createProjetoShape } from '@/lib/agent/tools/project-create'

/**
 * Etapa 3/4 (Agent Layer) — Tool Registry. Cada entrada pareia o ToolDef
 * (usado pelo Execution Engine) com o input shape zod (usado pelo MCP
 * server pra declarar o schema da ferramenta pro LLM).
 *
 * Duas fontes de tools:
 *  - Bespoke: lógica própria além de CRUD simples (métricas agregadas,
 *    resolução de cliente por nome, etc.) — um arquivo por domínio.
 *  - Genéricas: list/get/create/update/delete por módulo, geradas por
 *    buildModuleTools() a partir de uma config declarativa (crud.ts) —
 *    é assim que "todos os módulos, em todos os nichos" ficam expostos
 *    sem precisar de um handler bespoke pra cada tabela. Ver os arquivos
 *    modules-*.ts pra cada módulo coberto (e o que foi propositalmente
 *    deixado de fora, como prontuário clínico).
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
  { tool: listProjectTemplatesTool, inputShape: listProjectTemplatesShape },
  { tool: applyProjectTemplateTool, inputShape: applyProjectTemplateShape },
  { tool: createProjetoTool, inputShape: createProjetoShape },
  ...[...CRM_MODULES, ...VIAGENS_MODULES, ...CLINICAS_IMOVEIS_MODULES, ...SEGUROS_TRAFEGO_MODULES, ...AGENDA_MODULES]
    .flatMap(buildModuleTools),
]
