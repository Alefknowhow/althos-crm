/**
 * Detecta os campos `{{chave}}` de um template de documento — cada um vira
 * um campo de digitação manual na hora de gerar (sem auto-preenchimento a
 * partir do contato). Reaproveita a mesma sintaxe de `renderTemplate`
 * (`lib/inngest/functions.ts`), só que aqui extraímos as chaves em vez de
 * resolvê-las.
 */
export function extractFieldKeys(bodyHtml: string): string[] {
  if (!bodyHtml) return []
  const seen = new Set<string>()
  const out: string[] = []
  const re = /\{\{\s*([\w.]+)\s*\}\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(bodyHtml))) {
    const key = match[1].trim()
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

/** Humaniza uma chave (`nome_responsavel` -> "Nome responsavel") pra usar como label do campo. */
export function humanizeFieldKey(key: string): string {
  return key
    .replace(/[._]/g, ' ')
    .replace(/^./, c => c.toUpperCase())
}
