'use client'

/**
 * Detail drawer for a single form submission (lead info, answers, UTM
 * meta). Prop-driven, split out of FormResponsesView.tsx.
 */

import Link from 'next/link'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ExternalLink } from 'lucide-react'

type FormField = {
  id: string
  label: string
  type: string
  options?: string[]
}

type Lead = { id: string; name: string | null; email: string | null; phone: string | null } | null

type Submission = {
  id: string
  created_at: string
  data: Record<string, any> | null
  meta: Record<string, any> | null
  contato_id: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  contatos: Lead | Lead[] | null
}

function renderCell(field: FormField, value: any): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

export function FormResponseDetailSheet({
  orgSlug, fields, selected, selectedLead, onOpenChange,
}: {
  orgSlug: string
  fields: FormField[]
  selected: Submission | null
  selectedLead: Lead
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={!!selected} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {selected && (
          <>
            <SheetHeader>
              <SheetTitle>Resposta de {selectedLead?.name || 'Lead'}</SheetTitle>
              <p className="text-xs text-muted-foreground">
                {new Date(selected.created_at).toLocaleString('pt-BR')}
              </p>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Lead info */}
              {selectedLead && (
                <section>
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Lead
                  </h3>
                  <div className="border rounded-lg p-3 space-y-1 text-sm bg-muted/20">
                    <div>
                      <strong>Nome:</strong> {selectedLead.name || '—'}
                    </div>
                    <div>
                      <strong>E-mail:</strong> {selectedLead.email || '—'}
                    </div>
                    <div>
                      <strong>Telefone:</strong> {selectedLead.phone || '—'}
                    </div>
                    {selectedLead.id && (
                      <Link
                        href={`/app/${orgSlug}/contatos/${selectedLead.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs mt-1"
                      >
                        Abrir lead <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </section>
              )}

              {/* Answers */}
              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Respostas
                </h3>
                <div className="border rounded-lg divide-y">
                  {fields.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Sem campos definidos.</p>
                  ) : (
                    fields.map(f => (
                      <div key={f.id} className="p-3 text-sm">
                        <div className="text-xs text-muted-foreground">{f.label}</div>
                        <div className="font-medium break-words">
                          {renderCell(f, selected.data?.[f.id])}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Meta */}
              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Origem (meta)
                </h3>
                {selected.meta && Object.keys(selected.meta).length > 0 ? (
                  <div className="border rounded-lg divide-y text-xs font-mono">
                    {Object.entries(selected.meta).map(([k, v]) => (
                      <div key={k} className="p-2 flex gap-2">
                        <span className="text-muted-foreground min-w-[120px]">{k}</span>
                        <span className="break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados de origem.</p>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
