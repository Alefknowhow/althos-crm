/** Pacotes de Voice Credits à venda. Extraído de actions/voice-credits.ts
 *  porque um arquivo 'use server' só pode exportar funções async — uma
 *  constante como esta quebra o build do Next.js se ficar lá. */
export const VOICE_CREDIT_PACKS = [
  { id: 'p50', valueReais: 50, label: 'R$ 50' },
  { id: 'p150', valueReais: 150, label: 'R$ 150' },
  { id: 'p500', valueReais: 500, label: 'R$ 500' },
] as const
