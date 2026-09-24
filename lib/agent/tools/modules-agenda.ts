import type { ModuleConfig } from './crud'

/**
 * Módulo Agenda → Projetos (issue #17) — CRUD genérico via buildModuleTools()
 * (mesmo mecanismo de CRM_MODULES): list/get/create/update/delete_projetos,
 * com confirm:true já embutido em update/delete (crud.ts). column_id é a
 * etapa do Kanban configurável (project_columns); status é legado, não
 * exposto como writable pra não incentivar o agente a reescrevê-lo.
 */
export const AGENDA_MODULES: ModuleConfig[] = [
  {
    key: 'projetos',
    table: 'projetos',
    label: 'Projeto',
    permissionKey: 'projects',
    selectColumns: 'id, name, description, objective, client_id, owner_id, column_id, tags, health, start_date, due_date, completed_at, archived_at, created_at',
    searchColumn: 'name',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: ['name', 'description', 'objective', 'client_id', 'owner_id', 'column_id', 'tags', 'health', 'start_date', 'due_date'],
    requiredCreateFields: ['name'],
  },
]
