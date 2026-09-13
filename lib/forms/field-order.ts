/**
 * Ordem "linear" de um formulário no modo uma-pergunta-por-vez — campos de
 * contato (email/telefone/nome) vão pro final, o resto mantém a ordem do
 * schema. Extraído de OneQuestionForm.tsx pra ser compartilhado com o
 * canvas de fluxo (FormFlowCanvas.tsx), que precisa concordar com o mesmo
 * fallback de ordem que o renderizador público usa.
 */

export type FormFieldLike = { id: string; type: string; label: string }

const CONTACT_TYPES = new Set(['email', 'phone'])

export function isContactField(f: FormFieldLike): boolean {
  if (CONTACT_TYPES.has(f.type)) return true
  if (f.type === 'short_text' && /nome|name/i.test(f.label)) return true
  return false
}

export function getOrderedFields<T extends FormFieldLike>(fields: T[] | undefined | null): T[] {
  if (!fields) return []
  const nonContact = fields.filter(f => !isContactField(f))
  const contact = fields.filter(f => isContactField(f))
  return [...nonContact, ...contact]
}
