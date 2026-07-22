'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitNicheWaitlist } from '@/actions/public-leads'
import { CheckCircle2 } from 'lucide-react'

export function NicheWaitlistForm({ niche }: { niche: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const result = await submitNicheWaitlist(niche, {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      company: formData.get('company'),
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-none border border-emerald-800/50 bg-emerald-500/10 px-5 py-3 text-[14px] text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Você está na lista — avisamos assim que o módulo lançar.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row">
      <Input name="name" required maxLength={120} placeholder="Seu nome" className="sm:flex-1" />
      <Input name="email" type="email" required maxLength={160} placeholder="Seu e-mail" className="sm:flex-1" />
      <input type="hidden" name="phone" />
      <input type="hidden" name="company" />
      <Button type="submit" disabled={submitting} className="shrink-0">
        {submitting ? 'Enviando...' : 'Entrar na lista de espera'}
      </Button>
      {error && <p className="w-full text-center text-[13px] text-destructive">{error}</p>}
    </form>
  )
}
