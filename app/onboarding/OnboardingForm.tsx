'use client'

import { useState } from 'react'
import { createOrganization } from '@/actions/organization'
import { updateProfileInfo } from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { NICHE_OPTIONS } from '@/lib/niche'
import { ChevronRight, ChevronLeft, Building2, User, MapPin, CheckCircle2, Plus } from 'lucide-react'

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: 'Sobre você',    icon: User,      desc: 'Conte-nos um pouco sobre você' },
  { id: 2, title: 'Localização',   icon: MapPin,     desc: 'Onde fica seu negócio?' },
  { id: 3, title: 'Seu workspace', icon: Building2,  desc: 'Nomeie seu espaço de trabalho' },
] as const

const STATES_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

// ── Types ─────────────────────────────────────────────────────────────────────

type FormData = {
  full_name:     string
  phone:         string
  niche:         string
  address_city:  string
  address_state: string
  address_zip:   string
  org_name:      string
}

// ── Step progress indicator ───────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
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

// ── Shared wrapper ────────────────────────────────────────────────────────────

function PageWrapper({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] p-4">
      <div className="w-full max-w-[460px]">
        <div className="text-center mb-8">
          <span className="text-2xl font-black tracking-tighter text-slate-900">Althos CRM</span>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {children}
        <p className="text-center text-xs text-slate-500 mt-6">
          Plano Free para sempre · Sem cartão de crédito
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW ORG FORM — only org name (for users who already filled personal data)
// ═══════════════════════════════════════════════════════════════════════════════

function NewOrgForm() {
  const [orgName,  setOrgName]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit() {
    const name = orgName.trim()
    if (name.length < 2) {
      setError('O nome precisa ter ao menos 2 caracteres.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const fd = new FormData()
      fd.set('name', name)
      const res = await createOrganization(fd)

      if (!res.ok) {
        setError(res.error || 'Erro ao criar organização. Tente um nome diferente.')
        setLoading(false)
        return
      }

      window.location.href = res.redirectTo!
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <PageWrapper subtitle="Crie um novo workspace para sua organização.">
      <div className="bg-white text-slate-900 rounded-2xl shadow-lg p-8 space-y-6">

        {/* Icon + heading */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nova organização</p>
            <h2 className="text-lg font-bold leading-tight">Nome do workspace</h2>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Field */}
        <div className="space-y-1.5">
          <Label htmlFor="org_name">Nome da organização</Label>
          <Input
            id="org_name"
            placeholder="Minha Empresa, João Consultoria…"
            className="h-11"
            value={orgName}
            onChange={e => { setOrgName(e.target.value); setError('') }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          />
          <p className="text-xs text-slate-500">
            Você pode alterar o nome depois nas configurações.
          </p>
        </div>

        {/* Submit */}
        <Button
          type="button"
          className="w-full h-11 gap-2"
          disabled={loading || !orgName.trim()}
          onClick={handleSubmit}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Criando…
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Criar workspace
            </>
          )}
        </Button>
      </div>
    </PageWrapper>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL ONBOARDING WIZARD — new user, 3 steps
// ═══════════════════════════════════════════════════════════════════════════════

function FullOnboardingForm({ userEmail }: { userEmail?: string }) {
  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [form, setForm] = useState<FormData>({
    full_name:     '',
    phone:         '',
    niche:         '',
    address_city:  '',
    address_state: '',
    address_zip:   '',
    org_name:      '',
  })

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      setError('')
    }
  }

  // ── Validation per step ───────────────────────────────────────────────────

  function validateStep(n: number): string {
    if (n === 1) {
      if (!form.full_name.trim() || form.full_name.trim().length < 2)
        return 'Informe seu nome completo.'
      if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10)
        return 'Informe um telefone/WhatsApp válido.'
      if (!form.niche)
        return 'Selecione o segmento do seu negócio.'
    }
    if (n === 2) {
      if (!form.address_city.trim())
        return 'Informe sua cidade.'
      if (!form.address_state)
        return 'Selecione o estado.'
    }
    if (n === 3) {
      if (!form.org_name.trim() || form.org_name.trim().length < 2)
        return 'O nome do workspace precisa ter ao menos 2 caracteres.'
    }
    return ''
  }

  function next() {
    const err = validateStep(step)
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
  }

  function back() {
    setError('')
    setStep(s => s - 1)
  }

  // ── Final submit ──────────────────────────────────────────────────────────

  async function handleSubmit() {
    const err = validateStep(3)
    if (err) { setError(err); return }

    setLoading(true)
    setError('')

    try {
      // 1. Save personal data to user auth metadata
      await updateProfileInfo(form.full_name.trim(), form.phone.trim())

      // 2. Create the org
      const fd = new FormData()
      fd.set('name', form.org_name.trim())
      const res = await createOrganization(fd)

      if (!res.ok) {
        setError(res.error || 'Erro ao criar organização. Tente um nome diferente.')
        setLoading(false)
        return
      }

      // 3. Hard navigate so session cookies are picked up
      window.location.href = res.redirectTo!
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  const currentStep = STEPS[step - 1]

  return (
    <PageWrapper subtitle="Estamos quase lá! Só precisamos de algumas informações.">
      <div className="bg-white text-slate-900 rounded-2xl shadow-lg p-8 space-y-6">

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Step heading */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <currentStep.icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Passo {step} de {STEPS.length}
            </p>
            <h2 className="text-lg font-bold leading-tight">{currentStep.title}</h2>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* ── Step 1: Sobre você ──────────────────────────────────────────── */}
        {step === 1 && (
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
        )}

        {/* ── Step 2: Localização ─────────────────────────────────────────── */}
        {step === 2 && (
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
        )}

        {/* ── Step 3: Workspace ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org_name">Nome do workspace</Label>
              <Input
                id="org_name"
                placeholder="Minha Agência, João Vendas…"
                className="h-11 bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
                value={form.org_name}
                onChange={set('org_name')}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              />
              <p className="text-xs text-slate-500">
                Este será o nome visível no seu CRM. Você pode alterar depois nas configurações.
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              <p className="font-semibold text-xs uppercase tracking-wider text-slate-500 mb-2">Resumo</p>
              <div className="flex justify-between">
                <span className="text-slate-500">Nome</span>
                <span className="font-medium">{form.full_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">WhatsApp</span>
                <span className="font-medium">{form.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Segmento</span>
                <span className="font-medium">{form.niche || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cidade</span>
                <span className="font-medium">{form.address_city ? `${form.address_city} / ${form.address_state}` : '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation buttons ───────────────────────────────────────────── */}
        <div className={cn('flex gap-3', step === 1 ? 'justify-end' : 'justify-between')}>
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              className="h-11 px-5 gap-1.5"
              onClick={back}
              disabled={loading}
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
          )}

          {step < 3 ? (
            <Button
              type="button"
              className="h-11 px-6 gap-1.5 flex-1 sm:flex-none sm:min-w-[160px]"
              onClick={next}
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11 px-6 gap-1.5 flex-1"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Criando workspace…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Criar workspace e começar
                </>
              )}
            </Button>
          )}
        </div>

      </div>
    </PageWrapper>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Entry point — decides which form to render
// ═══════════════════════════════════════════════════════════════════════════════

export default function OnboardingForm({
  userEmail,
  isNewOrg = false,
}: {
  userEmail?: string
  isNewOrg?: boolean
}) {
  if (isNewOrg) {
    return <NewOrgForm />
  }
  return <FullOnboardingForm userEmail={userEmail} />
}
