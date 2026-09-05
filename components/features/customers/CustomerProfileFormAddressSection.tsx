'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Loader2 } from 'lucide-react'

const DARK_FIELD = 'dark:bg-black/40 dark:border-white/10'

/** Rótulo com altura fixa — evita que um CopyButton condicional (só aparece
 * com valor preenchido) empurre o input de uma coluna pra baixo em relação
 * às colunas vizinhas sem o botão. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="h-5 flex items-center gap-1.5">{children}</div>
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

type AddressForm = {
  postal_code:   string
  street:        string
  number:        string
  complement:    string
  district:      string
  city:          string
  state:         string
  country:       string
  address_notes: string
}

export function CustomerProfileFormAddressSection({
  form,
  setForm,
  cepLoading,
  onLookupCep,
}: {
  form:        AddressForm
  setForm:     (updater: (f: AddressForm) => AddressForm) => void
  cepLoading:  boolean
  onLookupCep: () => void
}) {
  return (
    <>
      {/* Endereço */}
      <div className="rounded-lg border border-border/80 p-3.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
          Endereço
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1.5 w-36">
            <FieldLabel><Label className="text-xs">CEP</Label></FieldLabel>
            <div className="flex gap-1">
              <Input
                className={DARK_FIELD}
                value={form.postal_code}
                onChange={e => setForm(f => ({ ...f, postal_code: maskCep(e.target.value) }))}
                placeholder="00000-000"
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLookupCep}
                disabled={cepLoading}
                title="Buscar endereço pelo CEP"
                className="shrink-0 px-2"
              >
                {cepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[220px]">
            <FieldLabel><Label className="text-xs">Rua / Logradouro</Label></FieldLabel>
            <Input
              className={DARK_FIELD}
              value={form.street}
              onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
              placeholder="Rua das Acácias"
            />
          </div>
          <div className="space-y-1.5 w-20">
            <FieldLabel><Label className="text-xs">Número</Label></FieldLabel>
            <Input
              className={DARK_FIELD}
              value={form.number}
              onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
              placeholder="123"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <FieldLabel><Label className="text-xs">Complemento</Label></FieldLabel>
            <Input
              className={DARK_FIELD}
              value={form.complement}
              onChange={e => setForm(f => ({ ...f, complement: e.target.value }))}
              placeholder="Apto 502, Bloco B"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <FieldLabel><Label className="text-xs">Bairro</Label></FieldLabel>
            <Input
              className={DARK_FIELD}
              value={form.district}
              onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
              placeholder="Centro"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <FieldLabel><Label className="text-xs">Cidade</Label></FieldLabel>
            <Input
              className={DARK_FIELD}
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              placeholder="Itajaí"
            />
          </div>
          <div className="space-y-1.5 w-16">
            <FieldLabel><Label className="text-xs">UF</Label></FieldLabel>
            <Input
              className={DARK_FIELD}
              value={form.state}
              onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))}
              placeholder="SC"
              maxLength={2}
            />
          </div>
          <div className="space-y-1.5 w-20">
            <FieldLabel><Label className="text-xs">País</Label></FieldLabel>
            <Input
              className={DARK_FIELD}
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value.toUpperCase().slice(0, 2) }))}
              placeholder="BR"
              maxLength={2}
            />
          </div>
        </div>
      </div>

      {/* Observações */}
      <div className="rounded-lg border border-border/80 p-3.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
          Observações internas
        </div>
        <Textarea
          className={DARK_FIELD}
          rows={3}
          value={form.address_notes}
          onChange={e => setForm(f => ({ ...f, address_notes: e.target.value }))}
          placeholder="Preferências, restrições, contexto pra futuro contato..."
        />
      </div>
    </>
  )
}
