// =====================================================================
// Contatos — constantes e tipos puros (client-safe).
// Mantidos fora de actions/contatos.ts ('use server') porque um arquivo
// 'use server' só pode exportar funções async.
// =====================================================================

/** Classificação do contato. "cliente" é apenas um status, não outra entidade. */
export const CONTATO_STATUSES = ['lead', 'cliente', 'inativo'] as const
export type ContatoStatus = (typeof CONTATO_STATUSES)[number]

export const CONTATO_STATUS_META: Record<
  ContatoStatus,
  { label: string; badgeClass: string; dot: string }
> = {
  lead: {
    label: 'Lead',
    badgeClass: 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-900/20',
    dot: 'bg-blue-500',
  },
  cliente: {
    label: 'Cliente',
    badgeClass: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20',
    dot: 'bg-emerald-500',
  },
  inativo: {
    label: 'Inativo',
    badgeClass: 'border-zinc-300 text-zinc-600 bg-zinc-50 dark:bg-zinc-800/40',
    dot: 'bg-zinc-400',
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
}

export function contatoSourceLabel(source: string | null | undefined): string {
  if (!source) return 'Sem origem'
  return CONTATO_SOURCE_LABELS[source] || source
}
