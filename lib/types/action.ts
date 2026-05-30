/**
 * Tipo de retorno padrão para todas as Server Actions.
 *
 * Uso:
 *   return { ok: true as const, data }
 *   return { ok: false as const, error: 'Mensagem de erro' }
 *
 * O `as const` é necessário para narrowing de TypeScript:
 *   if (res.ok) res.data  // TypeScript sabe que data existe
 *   else res.error        // TypeScript sabe que error existe
 */
export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string }

/**
 * Tipo de retorno para ações de listagem que podem falhar.
 * Retorna um array vazio em caso de erro para evitar crashes na UI.
 */
export type ListResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: string; data: [] }
