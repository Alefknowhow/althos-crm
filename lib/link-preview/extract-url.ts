/**
 * Puro/isomórfico (sem `Buffer`, sem `fetch` de servidor) — importável
 * tanto de componente client (WhatsappChat) quanto de código server.
 * Fica fora de actions/link-preview.ts porque um arquivo 'use server'
 * só pode exportar funções async (toda função vira uma server action
 * reference no bundle do client), e essa aqui é síncrona.
 */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"]+/i)
  if (!match) return null
  return match[0].replace(/[.,;:!?)]+$/, '')
}
