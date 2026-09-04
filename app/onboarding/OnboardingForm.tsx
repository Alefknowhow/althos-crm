'use client'

import { useState } from 'react'
import { createOrganization } from '@/actions/organization'
import { updateProfileInfo } from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react'
import { PageWrapper, NewOrgForm } from './OnboardingNewOrgForm'
import { STEPS, StepIndicator, StepAboutYou, StepLocation, type OnboardingFormData } from './OnboardingFormSteps'

type FormData = OnboardingFormData

// ═══════════════════════════════════════════════════════════════════════════════
// FULL ONBOARDING WIZARD — new user, 3 steps
// ═══════════════════════════════════════════════════════════════════════════════

function FullOnboardingForm({ userEmail: _userEmail }: { userEmail?: string }) {
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

      // 2. Create the org (niche chosen in step 1 is saved on the account so it
      //    shows up pre-selected in Configurações › Geral).
      const fd = new FormData()
      fd.set('name', form.org_name.trim())
      if (form.niche) fd.set('niche', form.niche)
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
        {step === 1 && <StepAboutYou form={form} set={set} />}

        {/* ── Step 2: Localização ─────────────────────────────────────────── */}
        {step === 2 && <StepLocation form={form} set={set} />}

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
              className="h-11 px-5 gap-1.5 bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900"
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
