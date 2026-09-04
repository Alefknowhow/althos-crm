'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const NICHES = [
  'E-commerce',
  'Infoproduto',
  'Comércio de Vendas',
  'Clínicas',
  'Escritório de Advogados',
  'Agências',
  'Educação',
  'Imobiliária',
  'Outros',
]

export interface OrgSetupFormData {
  name:          string
  contact_email: string
  contact_phone: string
  niche:         string
  address_city:  string
  address_state: string
  address_zip:   string
}

/**
 * Per-step field content for OrgSetupWizard. Split out of
 * OrgSetupWizard.tsx — purely presentational, form state passed in.
 */
export function OrgSetupWizardSteps({
  step, form, errors, patch,
}: {
  step: number
  form: OrgSetupFormData
  errors: Record<string, string>
  patch: (key: keyof OrgSetupFormData, value: string) => void
}) {
  if (step === 0) {
    return (
      <div className="space-y-2 max-w-lg">
        <Label htmlFor="name">Nome da empresa</Label>
        <Input
          id="name"
          value={form.name}
          onChange={e => patch('name', e.target.value)}
          placeholder="Preencha com o nome da sua empresa"
          className={cn('h-11', errors.name && 'border-destructive')}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
    )
  }

  if (step === 1) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="space-y-2">
          <Label htmlFor="contact_email">E-mail da empresa</Label>
          <Input
            id="contact_email"
            type="email"
            value={form.contact_email}
            onChange={e => patch('contact_email', e.target.value)}
            placeholder="Preencha com o e-mail da sua empresa"
            className={cn('h-11', errors.contact_email && 'border-destructive')}
          />
          {errors.contact_email && <p className="text-xs text-destructive">{errors.contact_email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact_phone">Telefone</Label>
          <div className={cn('flex rounded-md border overflow-hidden h-11', errors.contact_phone && 'border-destructive')}>
            <div className="flex items-center gap-1.5 px-3 border-r bg-muted shrink-0 text-sm text-muted-foreground select-none">
              <span>🇧🇷</span>
              <span>+55</span>
            </div>
            <input
              id="contact_phone"
              type="tel"
              value={form.contact_phone}
              onChange={e => patch('contact_phone', e.target.value)}
              placeholder="(11) 99999-9999"
              className="flex-1 px-3 text-sm bg-transparent outline-none"
            />
          </div>
          {errors.contact_phone && <p className="text-xs text-destructive">{errors.contact_phone}</p>}
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="space-y-3">
        {errors.niche && <p className="text-xs text-destructive mb-1">{errors.niche}</p>}
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          {NICHES.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => patch('niche', n)}
              className={cn(
                'h-20 rounded-none border-2 text-sm font-medium transition-all duration-150 px-3',
                form.niche === n
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40 text-foreground',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // step === 3
  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="address_city">Cidade</Label>
          <Input
            id="address_city"
            value={form.address_city}
            onChange={e => patch('address_city', e.target.value)}
            placeholder="São Paulo"
            className={cn('h-11', errors.address_city && 'border-destructive')}
          />
          {errors.address_city && <p className="text-xs text-destructive">{errors.address_city}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_state">Estado</Label>
          <Input
            id="address_state"
            value={form.address_state}
            onChange={e => patch('address_state', e.target.value)}
            placeholder="SP"
            maxLength={2}
            className={cn('h-11', errors.address_state && 'border-destructive')}
          />
          {errors.address_state && <p className="text-xs text-destructive">{errors.address_state}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address_zip">CEP <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <Input
          id="address_zip"
          value={form.address_zip}
          onChange={e => patch('address_zip', e.target.value)}
          placeholder="00000-000"
          className="h-11 max-w-[200px]"
        />
      </div>
    </div>
  )
}
