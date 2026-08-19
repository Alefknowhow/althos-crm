'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

export default function AparenciaTab() {
  const { theme, setTheme } = useTheme()
  // next-themes só resolve o tema real no client, depois da hidratação —
  // evita mismatch de SSR (server não sabe a preferência do navegador).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Aparência</h2>
        <p className="text-sm text-muted-foreground">Como o Althos aparece no seu navegador.</p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Tema</span>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          {OPTIONS.map(opt => {
            const active = mounted && theme === opt.value
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-none max-md:rounded-[8px] border p-4 text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {active && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />}
                <Icon className="h-5 w-5" />
                {opt.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          &quot;Sistema&quot; segue a preferência de claro/escuro do seu sistema operacional.
        </p>
      </div>

      <div className="space-y-1 border-t border-border pt-6">
        <span className="text-sm font-medium">Cor de destaque</span>
        <p className="text-sm text-muted-foreground">
          A cor usada nas cotações e na vitrine pública enviadas aos seus clientes fica na aba{' '}
          <span className="font-medium text-foreground">Geral</span>, junto com o logo da empresa.
        </p>
      </div>
    </div>
  )
}
