/**
 * Add-on pricing — mesma fonte usada em /planos (site) e docs/novo-modelo-de-precos.md.
 * Usuários e lojas/agências extras exigem Pro ou superior; módulos de nicho a
 * partir do Starter. Créditos de IA (CREDIT_PACKS) já vive em lib/plans/config.ts.
 */

export const EXTRA_USER_CENTS = 4700   // R$47/usuário/mês
export const EXTRA_ORG_CENTS  = 9700   // R$97/loja-agência/mês
export const NICHE_MODULE_CENTS       = 14700 // R$147/mês por módulo
export const FINANCEIRO_ONLY_CENTS    = 6700  // R$67/mês (só o módulo Financeiro)

export const NICHE_MODULE_OPTIONS: { id: string; label: string }[] = [
  { id: 'financeiro',   label: 'Financeiro (transversal)' },
  { id: 'viagens',      label: 'Viagens' },
  { id: 'clinicas',     label: 'Clínicas' },
  { id: 'imobiliarias', label: 'Imobiliárias' },
]
