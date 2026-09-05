'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CopyButton from '@/components/ui/copy-button'
import type { CustomerDoc } from '@/components/features/customers/CustomerDocuments'
import { DocumentsStrip } from './CustomerProfileFormDocumentsStrip'

const DARK_FIELD = 'dark:bg-black/40 dark:border-white/10'

/** Rótulo com altura fixa — evita que um CopyButton condicional (só aparece
 * com valor preenchido) empurre o input de uma coluna pra baixo em relação
 * às colunas vizinhas sem o botão. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="h-5 flex items-center gap-1.5">{children}</div>
}

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  let out = d
  if (d.length > 9) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  else if (d.length > 6) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  else if (d.length > 3) out = `${d.slice(0, 3)}.${d.slice(3)}`
  return out
}

type DocumentsForm = {
  cpf:              string
  rg:               string
  passport_number:  string
  passport_expiry:  string
  has_us_visa:      boolean
}

export function CustomerProfileFormDocumentsSection({
  orgSlug,
  form,
  setForm,
  initialDocuments,
  onManageDocs,
}: {
  orgSlug:           string
  form:              DocumentsForm
  setForm:           (updater: (f: DocumentsForm) => DocumentsForm) => void
  initialDocuments:  CustomerDoc[]
  onManageDocs:      () => void
}) {
  return (
    <div className="rounded-lg border border-border/80 p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
        Documentos
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1.5 w-40">
          <FieldLabel>
            <Label className="text-xs">CPF</Label>
            <CopyButton value={form.cpf} label="CPF" />
          </FieldLabel>
          <Input
            className={DARK_FIELD}
            value={form.cpf}
            onChange={e => setForm(f => ({ ...f, cpf: maskCpf(e.target.value) }))}
            placeholder="000.000.000-00"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5 w-40">
          <FieldLabel><Label className="text-xs">RG</Label></FieldLabel>
          <Input
            className={DARK_FIELD}
            value={form.rg}
            onChange={e => setForm(f => ({ ...f, rg: e.target.value }))}
            placeholder="00.000.000-0"
          />
        </div>
        <div className="space-y-1.5 w-40">
          <FieldLabel><Label className="text-xs">Nº do passaporte</Label></FieldLabel>
          <Input
            className={DARK_FIELD}
            value={form.passport_number}
            onChange={e => setForm(f => ({ ...f, passport_number: e.target.value.toUpperCase() }))}
            placeholder="AB123456"
          />
        </div>
        <div className="space-y-1.5 w-40">
          <FieldLabel><Label className="text-xs">Validade passaporte</Label></FieldLabel>
          <Input
            className={DARK_FIELD}
            type="date"
            value={form.passport_expiry}
            onChange={e => setForm(f => ({ ...f, passport_expiry: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel><Label className="text-xs">Visto americano</Label></FieldLabel>
          <label className={`flex items-center gap-2 h-10 px-3 rounded-md border border-input cursor-pointer ${DARK_FIELD}`}>
            <input
              type="checkbox"
              className="accent-primary w-4 h-4"
              checked={form.has_us_visa}
              onChange={e => setForm(f => ({ ...f, has_us_visa: e.target.checked }))}
            />
            <span className="text-sm">{form.has_us_visa ? 'Possui' : 'Não possui'}</span>
          </label>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border/60">
        <DocumentsStrip orgSlug={orgSlug} documents={initialDocuments} onManage={onManageDocs} />
      </div>
    </div>
  )
}
