'use client'

/**
 * Infraestrutura centralizada de atalhos (issue #10) — um único listener de
 * keydown (capture phase) na raiz do app, em vez de cada módulo criar o seu
 * (`window.addEventListener('keydown', ...)` espalhado). Componentes se
 * registram via `useShortcut`; o último registrado para um combo vence
 * (campo/editor ativo → modal/drawer ativo → contexto de página → atalhos
 * globais, na prática: quem monta por último — um modal aberto por cima do
 * conteúdo — fica no topo da pilha).
 *
 * Isto NÃO substitui o focus-trap/Escape nativo dos Dialog/Sheet do Radix
 * (components/ui/dialog.tsx, sheet.tsx) — aquilo já funciona sem mudança.
 * Este registro é para atalhos de produtividade (⌘K, ?, e futuros
 * contextuais), não para acessibilidade básica de modais.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { comboFromEvent, isTypingTarget, type ShortcutEntry } from '@/lib/shortcuts/registry'
import { ShortcutsHelpDialog } from './ShortcutsHelpDialog'

type Registered = ShortcutEntry & { handler: (e: KeyboardEvent) => void }

interface ShortcutContextValue {
  register: (entry: Registered) => () => void
  listActive: () => ShortcutEntry[]
}

const ShortcutContext = createContext<ShortcutContextValue | null>(null)

export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const stacksRef = useRef(new Map<string, Registered[]>())
  const [helpOpen, setHelpOpen] = useState(false)

  const register = useCallback((entry: Registered) => {
    const stacks = stacksRef.current
    const stack = stacks.get(entry.combo) ?? []
    stack.push(entry)
    stacks.set(entry.combo, stack)
    return () => {
      const current = stacks.get(entry.combo)
      if (!current) return
      const next = current.filter(e => e !== entry)
      if (next.length > 0) stacks.set(entry.combo, next)
      else stacks.delete(entry.combo)
    }
  }, [])

  const listActive = useCallback(() => {
    const out: ShortcutEntry[] = []
    Array.from(stacksRef.current.values()).forEach(stack => {
      const top = stack[stack.length - 1]
      if (top) out.push(top)
    })
    return out.sort((a, b) => a.group.localeCompare(b.group) || a.description.localeCompare(b.description))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const combo = comboFromEvent(e)
      const stack = stacksRef.current.get(combo)
      if (!stack || stack.length === 0) return
      const top = stack[stack.length - 1]
      if (isTypingTarget(e.target) && !top.allowInTypingContext) return
      top.handler(e)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const value = useMemo<ShortcutContextValue>(() => ({ register, listActive }), [register, listActive])

  // The "?" help overlay is itself just another registered shortcut —
  // dogfoods the same mechanism it documents. Registered directly (not via
  // useShortcut/useContext) because this component sits ABOVE its own
  // Provider, so useContext(ShortcutContext) here would read null.
  useEffect(() => register({
    combo: '?',
    description: 'Abrir ajuda de atalhos',
    group: 'Global',
    handler: () => setHelpOpen(v => !v),
  }), [register])

  return (
    <ShortcutContext.Provider value={value}>
      {children}
      <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} entries={listActive()} />
    </ShortcutContext.Provider>
  )
}

/**
 * Registra um atalho enquanto o componente estiver montado. `combo` usa
 * `mod` para Cmd/Ctrl (ex.: "mod+k"). Handlers de tecla única (sem `mod`)
 * nunca disparam enquanto o usuário digita, a menos que
 * `allowInTypingContext` seja explicitamente true.
 *
 * O handler é lido de uma ref a cada disparo (não recria o registro a cada
 * render) — só `combo`/`group`/`description`/`allowInTypingContext` mudando
 * re-registra de fato.
 */
export function useShortcut(entry: ShortcutEntry & { handler: (e: KeyboardEvent) => void }) {
  const ctx = useContext(ShortcutContext)
  const handlerRef = useRef(entry.handler)
  handlerRef.current = entry.handler

  useEffect(() => {
    if (!ctx) return
    return ctx.register({
      combo: entry.combo,
      description: entry.description,
      group: entry.group,
      allowInTypingContext: entry.allowInTypingContext,
      handler: e => handlerRef.current(e),
    })
    // handler vem da ref (handlerRef), sempre atual sem forçar re-registro
  }, [ctx, entry.combo, entry.description, entry.group, entry.allowInTypingContext])
}
