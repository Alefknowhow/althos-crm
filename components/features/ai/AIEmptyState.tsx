'use client'

/**
 * Estado inicial padrão ("Como posso ajudar?" + sugestões contextuais) de
 * todos os chats de IA (issue #68). Extraído de CopilotDockMessages.tsx.
 */

export function AIEmptyState({
  title = 'Como posso ajudar?',
  description,
  suggestions,
  onSelectSuggestion,
  icon,
}: {
  title?: string
  description?: string
  suggestions?: string[]
  onSelectSuggestion?: (text: string) => void
  icon?: React.ReactNode
}) {
  return (
    <div className="pt-6 space-y-5">
      <div className="space-y-1.5">
        {icon}
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="grid gap-2">
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onSelectSuggestion?.(s)}
              className="w-full text-left text-sm border border-border/70 rounded-2xl px-4 py-3 hover:bg-muted/60 hover:border-primary/40 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
