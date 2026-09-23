// Pure helpers for the centralized shortcut infrastructure (issue #10).
// Kept free of React/DOM globals so they're unit-testable.

export interface ShortcutEntry {
  combo: string
  description: string
  group: string
  /** Fires even while the user is typing in an input/textarea/contenteditable. Only Cmd/Ctrl-modified combos should opt into this. */
  allowInTypingContext?: boolean
}

/**
 * Normalizes a KeyboardEvent into a combo string like "mod+k" or "?".
 * `mod` covers both Cmd (mac) and Ctrl (others) so callers don't branch on
 * platform. Single printable keys are lowercased; everything else keeps the
 * DOM `key` value (e.g. "Escape", "ArrowDown").
 */
export function comboFromEvent(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>): string {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('mod')
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  // Shift só vira modificador explícito pra letras (perdem maiúscula ao
  // serem lowercased acima, ex.: Shift+K precisa de "shift" pra não colidir
  // com "k" puro). Teclas de símbolo (?, !, /) já são caracteres distintos
  // do não-shiftado — "?" (Shift+/) e "/" nunca colidem — então exigir
  // "shift+?" seria redundante e quebra o registro de quem passou só "?"
  // (achado da revisão automática da PR #35: '?' nunca disparava).
  const isLetter = /^[a-z]$/.test(key)
  if (e.shiftKey && isLetter) parts.push('shift')
  if (e.altKey) parts.push('alt')
  // Avoid double-counting the modifier as the "key" itself (e.g. pressing
  // just Shift fires a keydown with key === 'Shift').
  if (!['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) {
    parts.push(key)
  }
  return parts.join('+')
}

/**
 * True if the event target is somewhere the user is actively typing —
 * single-letter shortcuts (N, C, E, R, /, ?) must never fire here, per the
 * issue's "nunca enquanto o usuário estiver digitando" rule. Cmd/Ctrl-based
 * combos are expected to opt out via `allowInTypingContext`.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}
