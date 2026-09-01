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

/** Orientação de uso exibida em cada bloco — o que a classificação
 *  significa e como criar boas opções pro negócio, pra quem está montando
 *  a estrutura financeira pela primeira vez. */
export const FINANCIAL_SETTING_HINTS: Record<FinancialSettingType, string> = {
  categoria:
    'Agrupamento macro dos lançamentos (ex.: Vendas, Despesas fixas, Impostos, Investimentos). ' +
    'Use poucas categorias, bem amplas — é o nível que aparece nos gráficos e relatórios do Financeiro. ' +
    'Se você está criando muitas, provavelmente o que quer é uma Subcategoria.',
  subcategoria:
    'O detalhe dentro de uma categoria (ex.: dentro de "Despesas fixas": Aluguel, Internet, Salários, Software). ' +
    'Crie uma subcategoria pra cada tipo de gasto ou receita recorrente que você quer acompanhar separado no relatório.',
  centro_custo:
    'Quem ou qual área é responsável pelo lançamento (ex.: Comercial, Marketing, Administrativo, ou o nome de uma ' +
    'filial/vendedor). Serve pra saber quanto cada área da empresa consome ou gera, independente da categoria do gasto.',
  conta_bancaria:
    'As contas/caixas reais por onde o dinheiro entra e sai (ex.: "Banco X — Conta Corrente", "Caixa", "PagBank"). ' +
    'Cada lançamento é vinculado a uma conta, pra você acompanhar o saldo de cada uma separadamente.',
  operadora:
    'As operadoras/fornecedores de viagem que pagam comissão pelas vendas (ex.: CVC, Azul Viagens, Hoteldo). ' +
    'Configure como cada uma paga pra o Financeiro já lançar a receita na data certa — veja as opções de forma de pagamento abaixo.',
  forma_pagamento:
    'Como o cliente paga (ex.: Pix, Cartão de crédito, Débito, Boleto, Dinheiro). Cadastre a taxa cobrada por ' +
    'cada meio (ex.: cartão de crédito ~3,5%, boleto ~2%) pra saber o valor líquido recebido — Pix e Dinheiro ' +
    'geralmente ficam com taxa 0%. Não confundir com a forma de pagamento da Operadora (aquela é o repasse pra ' +
    'você, esta é o recebimento do cliente).',
}
