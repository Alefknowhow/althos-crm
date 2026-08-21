'use client'

export type Seller = { id: string; name: string }

/** Chips com checkbox pra filtrar quais vendedores entram no gráfico mensal
 *  e no comparativo — mesmo visual de toggle já usado em QuotationEditor.tsx
 *  (FARE_CONDITIONS). Estado local, sem ida ao servidor: quem chama já tem
 *  todos os vendedores carregados e só filtra o array em memória. */
export default function SellerChipFilter({
  sellers, selected, onChange,
}: { sellers: Seller[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  if (sellers.length <= 1) return null
  const allSelected = selected.size === sellers.length

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground mr-1">Vendedores:</span>
      <button
        type="button"
        onClick={() => onChange(new Set(sellers.map(s => s.id)))}
        aria-pressed={allSelected}
        className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
          allSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
        }`}
      >
        Todos
      </button>
      {sellers.map(s => {
        const active = selected.has(s.id)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
              active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {s.name}
          </button>
        )
      })}
    </div>
  )
}
