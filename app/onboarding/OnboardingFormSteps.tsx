'use client'

/**
 * Step progress indicator + step 1/2 field groups for the full onboarding
 * wizard. Split out of OnboardingForm.tsx.
 */

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { NICHE_OPTIONS } from '@/lib/niche'
import { Building2, User, MapPin, CheckCircle2 } from 'lucide-react'

export const STEPS = [
  { id: 1, title: 'Sobre você',    icon: User,      desc: 'Conte-nos um pouco sobre você' },
  { id: 2, title: 'Localização',   icon: MapPin,     desc: 'Onde fica seu negócio?' },
  { id: 3, title: 'Seu workspace', icon: Building2,  desc: 'Nomeie seu espaço de trabalho' },
] as const

const STATES_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

export type OnboardingFormData = {
  full_name:     string
  phone:         string
  niche:         string
  address_city:  string
  address_state: string
  address_zip:   string
  org_name:      string
}

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, idx) => {
        const done    = s.id < current
        const active  = s.id === current
        const pending = s.id > current
        return (
          <div key={s.id} className="flex items-center">
            <div
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border-2',
                done    && 'bg-primary border-primary text-primary-foreground',
                active  && 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/25',
                pending && 'bg-transparent border-slate-300 text-slate-400',
              )}
            >
              {done ? <CheckCircle2 className="w-4 h-4" /> : <span>{s.id}</span>}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn('w-16 h-0.5 mx-1 transition-all duration-300', done ? 'bg-primary' : 'bg-slate-200')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function StepAboutYou({
  form, set,
}: {
  form: OnboardingFormData
  set: (field: keyof OnboardingFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input
          id="full_name"
          placeholder="João Silva"
          className="h-11 bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
          value={form.full_name}
          onChange={set('full_name')}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">WhatsApp / Telefone</Label>
        <Input
          id="phone"
          placeholder="(11) 9 9999-9999"
          className="h-11 bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
          value={form.phone}
          onChange={set('phone')}
          type="tel"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="niche">Segmento do negócio</Label>
        <select
          id="niche"
          className="flex h-11 w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.niche}
          onChange={set('niche')}
        >
          <option value="">Selecione seu segmento…</option>
          {NICHE_OPTIONS.map(n => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function StepLocation({
  form, set,
}: {
  form: OnboardingFormData
  set: (field: keyof OnboardingFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="address_city">Cidade</Label>
        <Input
          id="address_city"
          placeholder="São Paulo"
          className="h-11 bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
          value={form.address_city}
          onChange={set('address_city')}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="address_state">Estado</Label>
          <select
            id="address_state"
            className="flex h-11 w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.address_state}
            onChange={set('address_state')}
          >
            <option value="">UF</option>
            {STATES_BR.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address_zip">CEP <span className="text-slate-500 font-normal">(opcional)</span></Label>
          <Input
            id="address_zip"
            placeholder="00000-000"
            className="h-11 bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
            value={form.address_zip}
            onChange={set('address_zip')}
            maxLength={9}
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Essas informações ajudam a personalizar o sistema para sua região.
      </p>
    </div>
  )
}
