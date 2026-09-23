'use client'

/**
 * Global command palette (⌘K / Ctrl+K).
 *
 * Three sections:
 *   1. Navigation — every sidebar destination is a one-keystroke jump.
 *   2. Search — debounced server call across leads + customers.
 *   3. Actions — quick theme toggle + sign out.
 *
 * Open via ⌘K (mac), Ctrl+K (others), or the trigger button mounted in
 * the layout header. ESC or backdrop click closes.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  Moon,
  Sun,
  LogOut,
  User as UserIcon,
  Star,
  HelpCircle,
} from 'lucide-react'
import { searchEverything, type SearchHit } from '@/actions/search'
import { replayOnboardingTour } from '@/components/features/OnboardingTour'
import { useShortcut } from '@/components/features/ShortcutProvider'
import { getGlobalNavEntries } from '@/lib/nav-entries'

export default function CommandPalette({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [, startTransition] = useTransition()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // ⌘K / Ctrl+K to toggle — registrado na infraestrutura centralizada de
  // atalhos (issue #10) em vez de um listener próprio.
  useShortcut({
    combo: 'mod+k',
    description: 'Busca rápida / command palette',
    group: 'Global',
    allowInTypingContext: true,
    handler: e => {
      e.preventDefault()
      setOpen(v => !v)
    },
  })

  // Debounced server search. Empty query clears results immediately.
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await searchEverything(orgSlug, q)
          setHits(res)
        } catch {
          setHits([])
        }
      })
    }, 180)
    return () => clearTimeout(t)
  }, [query, open, orgSlug])

  // Reset state on close so reopen feels fresh.
  useEffect(() => {
    if (!open) {
      setQuery('')
      setHits([])
    }
  }, [open])

  const base = `/app/${orgSlug}`
  const navEntries = getGlobalNavEntries(base)

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Pesquisar qualquer coisa: lead, cliente, módulo ou ação..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.length < 2 ? (
            <span className="text-muted-foreground">Digite ao menos 2 caracteres.</span>
          ) : (
            <span className="text-muted-foreground">Nada encontrado.</span>
          )}
        </CommandEmpty>

        {hits.length > 0 && (
          <>
            <CommandGroup heading="Resultados">
              {hits.map(h => {
                const Icon = h.kind === 'customer' ? Star : UserIcon
                return (
                  <CommandItem
                    key={`${h.kind}-${h.id}`}
                    value={`${h.title} ${h.subtitle || ''} ${h.kind}`}
                    onSelect={() => go(h.href)}
                  >
                    <Icon
                      className={
                        h.kind === 'customer'
                          ? 'text-amber-500'
                          : 'text-muted-foreground'
                      }
                    />
                    <div className="flex flex-col">
                      <span>{h.title}</span>
                      {h.subtitle && (
                        <span className="text-xs text-muted-foreground">{h.subtitle}</span>
                      )}
                    </div>
                    <CommandShortcut className="capitalize">
                      {h.kind === 'customer' ? 'cliente' : 'lead'}
                    </CommandShortcut>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Ir para">
          {navEntries.map(n => {
            const Icon = n.icon
            return (
              <CommandItem
                key={n.href}
                value={`${n.label} ${n.keywords || ''}`}
                onSelect={() => go(n.href)}
              >
                <Icon className="text-muted-foreground" />
                <span>{n.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações">
          <CommandItem
            value="tour onboarding ajuda help refazer"
            onSelect={() => {
              setOpen(false)
              // Defer so the dialog has time to unmount before the tour
              // paints — otherwise the welcome modal lands behind it.
              setTimeout(replayOnboardingTour, 100)
            }}
          >
            <HelpCircle className="text-muted-foreground" />
            <span>Refazer tour de boas-vindas</span>
          </CommandItem>
          <CommandItem
            value="tema theme dark light alternar"
            onSelect={() => {
              setTheme(theme === 'dark' ? 'light' : 'dark')
              setOpen(false)
            }}
          >
            {theme === 'dark' ? (
              <Sun className="text-muted-foreground" />
            ) : (
              <Moon className="text-muted-foreground" />
            )}
            <span>Alternar tema {theme === 'dark' ? 'claro' : 'escuro'}</span>
          </CommandItem>
          <CommandItem
            value="sair logout sign out"
            onSelect={async () => {
              setOpen(false)
              const { logout } = await import('@/actions/auth')
              await logout()
            }}
          >
            <LogOut className="text-muted-foreground" />
            <span>Sair</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

/**
 * Header trigger — visible button + keyboard hint. Renders the palette
 * itself; pairing in one component avoids prop-drilling open state.
 */
export function CommandPaletteTrigger({ orgSlug: _orgSlug }: { orgSlug: string }) {
  // Detect platform once for the displayed shortcut hint. Falls back to
  // Ctrl on unknown UAs.
  const [isMac, setIsMac] = useState(false)
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform))
    }
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Fire the global toggle by simulating ⌘K. Cleaner than lifting
          // state — the palette's own listener picks it up.
          window.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: isMac,
              ctrlKey: !isMac,
              bubbles: true,
            }),
          )
        }}
        aria-label="Abrir busca rápida"
        data-tour="cmdk"
        className="hidden sm:inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors"
      >
        <span>Buscar</span>
        <kbd className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded bg-background border border-border">
          {isMac ? '⌘' : 'Ctrl'}
          <span>K</span>
        </kbd>
      </button>
    </>
  )
}

/** Dispara o mesmo toggle global do ⌘K — usado por qualquer trigger visual
 *  (botão compacto mobile, barra de busca desktop) sem duplicar o diálogo. */
export function openCommandPalette() {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: isMac,
      ctrlKey: !isMac,
      bubbles: true,
    }),
  )
}
