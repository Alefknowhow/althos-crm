'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STEP_TYPES } from './AutomationFlowMeta'

type StepStat = { success: number; errors: number }

// ── FlowNode card ─────────────────────────────────────────────────────────────

export function FlowNode({
  icon: Icon,
  color,
  typeLabel,
  nodeName,
  detail,
  badge,
  onDelete,
  stats,
  config,
}: {
  icon: any
  color: string
  typeLabel: string
  nodeName: string
  detail: string
  badge?: string
  onDelete?: () => void
  stats?: StepStat
  /** Campos de configuração, sempre visíveis (nunca precisou de seleção/expansão — já era assim no canvas). */
  config?: React.ReactNode
}) {
  return (
    <div className="relative group/node w-[320px] shrink-0">
      <div className="bg-card border rounded-md text-left">
        {/* Colored top strip */}
        <div className="h-1 rounded-t-md w-full" style={{ backgroundColor: color }} />

        {/* Header */}
        <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <Icon className="w-[15px] h-[15px]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
            {typeLabel}
          </span>
          {badge && (
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {badge}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="px-3 pb-2 border-t border-border/40 pt-2">
          <p className="text-sm font-semibold leading-tight">{nodeName}</p>
          {!config && <p className="text-xs text-muted-foreground leading-relaxed mt-1">{detail}</p>}
        </div>

        {/* Config fields */}
        {config && <div className="px-3 pb-3 pt-1 space-y-2.5">{config}</div>}

        {/* Footer — contadores de execução (só nos steps, não no trigger) */}
        {stats !== undefined ? (
          <div className="px-3 py-2 border-t border-border/30 bg-muted/30 rounded-b-md grid grid-cols-2 divide-x divide-border/40">
            <div className="flex flex-col items-center gap-0.5 pr-1">
              <span className={cn('text-[11px] font-bold tabular-nums', stats.success > 0 ? 'text-emerald-500' : 'text-muted-foreground/40')}>
                {stats.success}
              </span>
              <span className="text-[8px] uppercase tracking-wide text-muted-foreground/50">Sucessos</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 pl-1">
              <span className={cn('text-[11px] font-bold tabular-nums', stats.errors > 0 ? 'text-red-500' : 'text-muted-foreground/40')}>
                {stats.errors}
              </span>
              <span className="text-[8px] uppercase tracking-wide text-muted-foreground/50">Erros</span>
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 border-t border-border/30 bg-muted/30 rounded-b-md">
            <p className="text-[10px] text-muted-foreground/50 font-medium text-center">Início do fluxo</p>
          </div>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/node:opacity-100 transition-opacity flex items-center justify-center z-10"
          title="Remover passo"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ── Connector — linha vertical + botão de inserir entre dois cards ───────────

export function Connector({ onInsert }: { onInsert: (type: string) => void }) {
  return (
    <div className="flex flex-row items-center px-1 shrink-0 self-center">
      <div className="h-px w-3 bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Inserir passo aqui"
            className="w-7 h-7 rounded-full border-2 border-border bg-background text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52 max-h-[60vh] overflow-y-auto">
          <DropdownMenuLabel className="text-xs">Inserir passo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STEP_TYPES.map(t => (
            <DropdownMenuItem key={t.id} onClick={() => onInsert(t.id)}>
              <t.icon className="w-4 h-4 mr-2 shrink-0" style={{ color: t.color }} />
              <span className="text-sm">{t.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="h-px w-3 bg-border" />
      <ArrowRight className="w-3.5 h-3.5 text-border -ml-1" />
    </div>
  )
}
