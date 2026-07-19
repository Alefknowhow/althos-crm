'use client'

/**
 * OrgSetupWizard — mandatory 4-step company setup shown on first login.
 *
 * Rendered as a full-screen overlay by the org layout when
 * organizations.onboarding_completed = false. Cannot be dismissed.
 *
 * Steps:
 *   1. Nome da empresa
 *   2. Contato (e-mail + telefone)
 *   3. Nicho do negócio
 *   4. Endereço
 *
 * On completion, calls completeOrgSetup() which sets onboarding_completed=true
 * and revalidates the layout — the overlay disappears automatically.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeOrgSetup } from '@/actions/organization'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Nicho options ─────────────────────────────────────────────────────────────
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

const STEPS = [
  { label: 'Nome da empresa' },
  { label: 'Contato' },
  { label: 'Nicho' },
  { label: 'Endereço' },
]

const STEP_TITLES = [
  'Bem-vindo!',
  'Como podemos falar com você?',
  'Qual é o nicho da sua empresa?',
  'Onde sua empresa está localizada?',
]

const STEP_SUBTITLES = [
  'Conte-nos como sua empresa se chamará.',
  'Informe e-mail e telefone para contato.',
  'Selecione um dos nichos abaixo.',
  'Preencha os dados de localização da sua empresa.',
]

interface FormData {
  name:          string
  contact_email: string
  contact_phone: string
  niche:         string
  address_city:  string
  address_state: string
  address_zip:   string
}

interface Props {
  orgSlug:     string
  initialName: string
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ index, current }: { index: number; current: number }) {
  const done   = index < current
  const active = index === current
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-all',
          done   && 'bg-primary text-primary-foreground',
          active && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
          !done && !active && 'border-2 border-muted-foreground/30 text-muted-foreground',
        )}
      >
        {done ? <Check className="w-4 h-4" /> : index + 1}
      </div>
      <span
        className={cn(
          'text-sm font-medium',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {STEPS[index].label}
      </span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OrgSetupWizard({ orgSlug, initialName }: Props) {
  const router = useRouter()
  const [step, setStep]       = useState(0)
  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [isPending, start]    = useTransition()

  const [form, setForm] = useState<FormData>({
    name:          initialName,
    contact_email: '',
    contact_phone: '',
    niche:         '',
    address_city:  '',
    address_state: '',
    address_zip:   '',
  })

  function patch(key: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  // ── Validation per step ───────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {}
    if (step === 0 && !form.name.trim())
      e.name = 'Nome da empresa é obrigatório'
    if (step === 1) {
      if (!form.contact_email.trim()) e.contact_email = 'E-mail é obrigatório'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email))
        e.contact_email = 'E-mail inválido'
      if (!form.contact_phone.trim()) e.contact_phone = 'Telefone é obrigatório'
    }
    if (step === 2 && !form.niche)
      e.niche = 'Selecione um nicho'
    if (step === 3) {
      if (!form.address_city.trim())  e.address_city  = 'Cidade é obrigatória'
      if (!form.address_state.trim()) e.address_state = 'Estado é obrigatório'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validate()) return
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      // Final step — save
      start(async () => {
        const res = await completeOrgSetup(orgSlug, form)
        if (!res.ok) {
          toast.error((res as any).error || 'Erro ao salvar. Tente novamente.')
        } else {
          toast.success('Empresa configurada! Bem-vindo ao Althos CRM.')
          router.refresh()
        }
      })
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="light fixed inset-0 z-[200] bg-[#eef2f7] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-none   overflow-hidden flex min-h-[520px]">

        {/* ── Left sidebar ─────────────────────────────────────────────── */}
        <div className="w-[300px] shrink-0 bg-white border-r border-border p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Cadastre sua empresa</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Informe os dados da sua empresa para que possamos deixar tudo arrumado para você.
              </p>
            </div>

            <div className="space-y-4">
              {STEPS.map((_, i) => (
                <StepIndicator key={i} index={i} current={step} />
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">© Althos CRM</p>
        </div>

        {/* ── Content area ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-xl font-bold tracking-tight">{STEP_TITLES[step]}</h1>
            <span className="text-sm text-muted-foreground shrink-0 ml-4 pt-1">
              {step + 1}/{STEPS.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-sm text-muted-foreground mb-6">{STEP_SUBTITLES[step]}</p>

          {/* Step content */}
          <div className="flex-1">
            {step === 0 && (
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
            )}

            {step === 1 && (
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
            )}

            {step === 2 && (
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
            )}

            {step === 3 && (
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
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border mt-6">
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(s => s - 1)}
                disabled={isPending}
              >
                Voltar
              </Button>
            )}
            <Button
              type="button"
              onClick={next}
              disabled={isPending}
              className="min-w-[100px]"
            >
              {isPending ? 'Salvando…' : step === STEPS.length - 1 ? 'Concluir' : 'Próximo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
