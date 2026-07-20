// Shared types/constants for financial settings lists — kept out of
// actions/financial-settings.ts ('use server') since that file can only
// export async functions.

export type FinancialSettingType =
  | 'categoria' | 'subcategoria' | 'centro_custo' | 'conta_bancaria' | 'operadora' | 'forma_pagamento'

export const FINANCIAL_SETTING_TYPES: { type: FinancialSettingType; label: string }[] = [
  { type: 'categoria', label: 'Categorias' },
  { type: 'subcategoria', label: 'Subcategorias' },
  { type: 'centro_custo', label: 'Centros de custo' },
  { type: 'conta_bancaria', label: 'Contas bancárias' },
  { type: 'operadora', label: 'Operadoras' },
  { type: 'forma_pagamento', label: 'Formas de pagamento' },
]
