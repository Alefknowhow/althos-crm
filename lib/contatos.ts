// =====================================================================
// Contatos — constantes e tipos puros (client-safe).
// Mantidos fora de actions/contatos.ts ('use server') porque um arquivo
// 'use server' só pode exportar funções async.
// =====================================================================

/** Classificação do contato. "cliente" é apenas um status, não outra entidade. */
export const CONTATO_STATUSES = ['lead', 'cliente', 'inativo', 'fornecedor', 'colaborador'] as const
export type ContatoStatus = (typeof CONTATO_STATUSES)[number]

export const CONTATO_STATUS_META: Record<
  ContatoStatus,
  { label: string; badgeClass: string; dot: string }
> = {
  lead: {
    label: 'Lead',
    badgeClass: 'border-transparent text-info bg-info/15',
    dot: 'bg-info',
  },
  cliente: {
    label: 'Cliente',
    badgeClass: 'border-transparent text-success bg-success/15',
    dot: 'bg-success',
  },
  inativo: {
    label: 'Inativo',
    badgeClass: 'border-transparent text-muted-foreground bg-muted',
    dot: 'bg-muted-foreground/60',
  },
  fornecedor: {
    label: 'Fornecedor',
    badgeClass: 'border-transparent text-warning bg-warning/15',
    dot: 'bg-warning',
  },
  colaborador: {
    label: 'Colaborador',
    badgeClass: 'border-transparent text-violet-600 dark:text-violet-300 bg-violet-500/15',
    dot: 'bg-violet-500',
  },
}

/**
 * Rótulo amigável para a origem do contato. `source` é texto livre — pode vir
 * do slug/id de um formulário, de integrações, ou dos valores fixos abaixo.
 * Quando não casar com um valor conhecido, mostramos o próprio texto.
 */
export const CONTATO_SOURCE_LABELS: Record<string, string> = {
  manual: 'Cadastro manual',
  form: 'Formulário',
  import: 'Importação',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  meta_ads: 'Meta Ads',
  pipeline: 'Pipeline',
  api: 'API',
  indicacao: 'Indicação',
}

/** Opções editáveis de origem (Select do cabeçalho do contato) — subconjunto
 *  de CONTATO_SOURCE_LABELS que faz sentido escolher manualmente (fica de
 *  fora "pipeline"/"api", que são só rótulos de origens automáticas). */
export const CONTATO_SOURCE_EDIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'manual', label: 'Cadastro manual' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'indicacao', label: 'Indicação' },
]

export function contatoSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Sem origem'
  return CONTATO_SOURCE_LABELS[source] || source
}
