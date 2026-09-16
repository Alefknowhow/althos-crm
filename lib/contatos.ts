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
    badgeClass: 'border-transparent text-info-foreground bg-info',
    dot: 'bg-info',
  },
  cliente: {
    label: 'Cliente',
    badgeClass: 'border-transparent text-success-foreground bg-success',
    dot: 'bg-success',
  },
  inativo: {
    label: 'Inativo',
    badgeClass: 'border-transparent text-secondary-foreground bg-muted-foreground/60',
    dot: 'bg-muted-foreground/60',
  },
  fornecedor: {
    label: 'Fornecedor',
    badgeClass: 'border-transparent text-warning-foreground bg-warning',
    dot: 'bg-warning',
  },
  colaborador: {
    label: 'Colaborador',
    badgeClass: 'border-transparent text-white bg-violet-500',
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
