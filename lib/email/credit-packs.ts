/** Pacotes de Email Credits à venda. Fora de actions/ porque um arquivo
 *  'use server' só pode exportar funções async — mesmo padrão de
 *  lib/voice/credit-packs.ts. */
export const EMAIL_CREDIT_PACKS = [
  { id: 'e50', valueReais: 50, label: 'R$ 50' },
  { id: 'e150', valueReais: 150, label: 'R$ 150' },
  { id: 'e500', valueReais: 500, label: 'R$ 500' },
] as const
