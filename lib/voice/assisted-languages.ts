/**
 * Idiomas com atalho na UI da chamada assistida (CallDialerModal,
 * AssistedCallPanel) — extraído de actions/voice-assisted.ts porque um
 * arquivo `'use server'` só pode exportar funções async; uma constante
 * (array) ali quebra o build ("A 'use server' file can only export async
 * functions, found object").
 */
export const ASSISTED_CALL_LANGUAGES = [
  { value: 'en', label: 'Inglês' },
  { value: 'es', label: 'Espanhol' },
  { value: 'fr', label: 'Francês' },
  { value: 'de', label: 'Alemão' },
  { value: 'it', label: 'Italiano' },
  { value: 'zh', label: 'Mandarim' },
]
