import type { ModuleConfig } from './crud'

/**
 * Módulos do CRM genérico (Vendas/Marketing) — ver crud.ts pra como cada
 * config vira 5 tools (list/get/create/update/delete).
 */
export const CRM_MODULES: ModuleConfig[] = [
  {
    key: 'contatos',
    table: 'contatos',
    label: 'Contato (lead ou cliente)',
    // Contatos cobre lead e cliente na mesma tabela; a permissão real do
    // app varia por status (leads/clients), mas a tool precisa de UMA
    // chave estática — 'leads' é a mais ampla das duas.
    permissionKey: 'leads',
    selectColumns: 'id, name, email, phone, city, state, pipeline_id, stage_id, value_cents, status, source, tags, assigned_to, created_at',
    searchColumn: 'name',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: ['name', 'email', 'phone', 'value_cents', 'tags', 'source', 'pipeline_id', 'stage_id', 'assigned_to', 'status'],
    requiredCreateFields: ['name'],
  },
  {
    key: 'pipelines',
    table: 'pipelines',
    label: 'Pipeline',
    permissionKey: 'pipeline',
    selectColumns: 'id, name, is_default, created_at',
    orderBy: { column: 'name' },
    writableFields: ['name'],
    requiredCreateFields: ['name'],
  },
  {
    key: 'etapas_pipeline',
    table: 'pipeline_stages',
    label: 'Etapa de pipeline',
    permissionKey: 'pipeline',
    selectColumns: 'id, name, position, color, pipeline_id',
    orderBy: { column: 'position' },
    writableFields: ['pipeline_id', 'name', 'position', 'color'],
    requiredCreateFields: ['pipeline_id', 'name'],
  },
  {
    key: 'negocios',
    table: 'negocios',
    label: 'Negócio (deal)',
    permissionKey: 'pipeline',
    selectColumns: 'id, contato_id, pipeline_id, stage_id, value_cents, status, won_at, lost_at, created_at',
    orderBy: { column: 'created_at', ascending: false },
    writableFields: ['contato_id', 'pipeline_id', 'stage_id', 'value_cents', 'status', 'won_at', 'lost_at'],
    requiredCreateFields: ['contato_id', 'pipeline_id', 'stage_id'],
  },
  {
    key: 'tarefas',
    table: 'tasks',
    label: 'Tarefa',
    // Complementa get_tasks/create_task (tools/tasks.ts) com get/update/
    // delete por id — nomes diferentes (tarefas ≠ tasks) pra não colidir.
    permissionKey: 'tasks',
    selectColumns: 'id, title, description, due_date, priority, status, contato_id, assigned_to, column_id, created_at',
    searchColumn: 'title',
    orderBy: { column: 'due_date' },
    writableFields: ['title', 'description', 'due_date', 'priority', 'status', 'contato_id', 'assigned_to', 'column_id'],
    requiredCreateFields: ['title'],
  },
  {
    key: 'formularios',
    table: 'forms',
    label: 'Formulário',
    permissionKey: 'forms',
    selectColumns: 'id, name, slug, pipeline_id, stage_id, is_active, created_at',
    searchColumn: 'name',
    writableFields: ['name', 'slug', 'schema', 'pipeline_id', 'stage_id', 'is_active'],
    requiredCreateFields: ['name'],
  },
  {
    key: 'respostas_formulario',
    table: 'form_submissions',
    label: 'Resposta de formulário',
    permissionKey: 'forms',
    selectColumns: 'id, form_id, contato_id, data, utm_source, utm_medium, utm_campaign, created_at',
    orderBy: { column: 'created_at', ascending: false },
    // Registro de submissão pública — não faz sentido o agente criar ou
    // reescrever, só consultar/excluir (ex.: pedido de remoção de dados).
    writableFields: [],
    creatable: false,
    updatable: false,
  },
  {
    key: 'financeiro',
    table: 'financial_entries',
    label: 'Lançamento financeiro',
    permissionKey: 'financial',
    selectColumns: 'id, tipo, categoria, subcategoria, centro_custo, conta_bancaria, forma_pagamento, valor_cents, competencia, vencimento, data_pagamento, status, contato_id, observacoes, tags, nota_fiscal, numero_documento, created_at',
    orderBy: { column: 'vencimento', ascending: false },
    writableFields: [
      'tipo', 'categoria', 'subcategoria', 'centro_custo', 'conta_bancaria', 'forma_pagamento',
      'valor_cents', 'competencia', 'vencimento', 'data_pagamento', 'status', 'contato_id',
      'observacoes', 'tags', 'nota_fiscal', 'numero_documento',
    ],
    requiredCreateFields: ['tipo', 'valor_cents'],
  },
]
