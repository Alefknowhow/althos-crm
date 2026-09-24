import type Anthropic from '@anthropic-ai/sdk'
import { listTasksForProject, createTask, updateTask } from '@/actions/tasks-crud'

/**
 * Tools de Tasks do Especialista de Projetos (issue #17 §7), com o projeto em
 * foco (params.id da rota) travado no servidor — nunca lido do input do
 * modelo. As tools genéricas `list_tarefas`/`create_tarefas`/`update_tarefas`
 * (lib/agent/tools/modules-crm.ts) são org-wide e não têm project_id em
 * selectColumns/writableFields, então o Copilot só enxergava/gravava tasks
 * fora do projeto (achado da revisão do PR #55). Substituem essas 3 no
 * conjunto de tools oferecido pela rota do copilot; list_tarefas/get_tarefas
 * genéricas continuam fora do allowlist do copilot de propósito.
 */

const LIST_NAME = 'list_project_tasks'
const CREATE_NAME = 'create_project_task'
const UPDATE_NAME = 'update_project_task'

export function projectTaskToolNames(): string[] {
  return [LIST_NAME, CREATE_NAME, UPDATE_NAME]
}

export function projectTaskAnthropicTools(): Anthropic.Messages.Tool[] {
  return [
    {
      name: LIST_NAME,
      description: 'Lista as tarefas do projeto em foco (só deste projeto, nunca de outro).',
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'doing', 'done'], description: 'Filtra por status (opcional).' },
        },
      },
    },
    {
      name: CREATE_NAME,
      description: 'Cria uma tarefa vinculada ao projeto em foco. Reversível (pode ser excluída depois).',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          due_date: { type: 'string', description: 'ISO 8601 (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:00.000Z)' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'] },
          assigned_to: { type: 'string', description: 'UUID do responsável (opcional)' },
        },
        required: ['title'],
      },
    },
    {
      name: UPDATE_NAME,
      description: 'Atualiza uma tarefa do projeto em foco (recusa se a tarefa for de outro projeto). Ação irreversível nos campos anteriores — confirme com o usuário antes de chamar com confirm:true.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUID da tarefa' },
          title: { type: 'string' },
          description: { type: 'string' },
          due_date: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'normal', 'high'] },
          status: { type: 'string', enum: ['open', 'doing', 'done'] },
          confirm: { type: 'boolean', description: 'Só executa com confirm:true — sem isso, devolve um preview.' },
        },
        required: ['id'],
      },
    },
  ]
}

/** Devolve null se `name` não é uma das 3 tools acima — caller cai pro
 *  executor genérico. */
export function buildProjectTaskExecutor(orgSlug: string, projectId: string) {
  return async (name: string, input: Record<string, unknown>): Promise<string | null> => {
    if (name === LIST_NAME) {
      const tasks = await listTasksForProject(orgSlug, projectId)
      const status = typeof input.status === 'string' ? input.status : undefined
      const filtered = status ? tasks.filter((t: any) => t.status === status) : tasks
      return JSON.stringify({ ok: true, data: filtered.map((t: any) => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, assigned_to: t.assigned_to,
      })) })
    }

    if (name === CREATE_NAME) {
      const res = await createTask(orgSlug, {
        title: String(input.title || ''),
        description: typeof input.description === 'string' ? input.description : undefined,
        due_date: typeof input.due_date === 'string' ? input.due_date : undefined,
        priority: (input.priority as 'low' | 'normal' | 'high' | undefined) ?? undefined,
        assigned_to: typeof input.assigned_to === 'string' ? input.assigned_to : undefined,
        project_id: projectId,
      })
      return JSON.stringify(res)
    }

    if (name === UPDATE_NAME) {
      const id = String(input.id || '')
      if (!id) return JSON.stringify({ ok: false, error: 'id é obrigatório' })

      // Recusa mexer numa task que não é deste projeto — o único jeito de um
      // id "vazar" aqui é o modelo inventar um UUID de outro projeto.
      const tasks = await listTasksForProject(orgSlug, projectId)
      const current = tasks.find((t: any) => t.id === id)
      if (!current) return JSON.stringify({ ok: false, error: 'Tarefa não encontrada neste projeto.' })

      const patch: Record<string, unknown> = {}
      for (const f of ['title', 'description', 'due_date', 'priority', 'status'] as const) {
        if (input[f] !== undefined) patch[f] = input[f]
      }
      if (Object.keys(patch).length === 0) return JSON.stringify({ ok: false, error: 'Nenhum campo pra atualizar.' })

      if (!input.confirm) {
        return JSON.stringify({
          confirmationRequired: true,
          message: 'Confirme com o usuário no chat antes de reescrever esta tarefa. Chame de novo com confirm:true só depois da confirmação explícita.',
          currentValues: { title: current.title, description: current.description, due_date: current.due_date, priority: current.priority, status: current.status },
          proposedValues: patch,
        })
      }

      const res = await updateTask(orgSlug, id, patch as any)
      return JSON.stringify(res)
    }

    return null
  }
}
