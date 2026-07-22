'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { submitBusinessLead } from '@/actions/public-leads'
import { CheckCircle2 } from 'lucide-react'

export function BusinessLeadForm() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const formData = new FormData(e.currentTarget)
    const result = await submitBusinessLead({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      company: formData.get('company'),
      message: formData.get('message'),
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
      <div className="flex flex-col items-center gap-3 rounded-none border border-[#383838] bg-[#262626] p-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <h2 className="text-lg font-bold text-[#f4f4f4]">Recebemos sua solicitação</h2>
        <p className="max-w-sm text-[14px] text-[#a8a8a8]">
          Nosso time comercial entra em contato em até 1 dia útil pra entender sua operação e montar o plano Business ideal.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-none border border-[#383838] bg-[#262626] p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" required maxLength={120} placeholder="Seu nome" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required maxLength={160} placeholder="voce@empresa.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone / WhatsApp</Label>
          <Input id="phone" name="phone" maxLength={40} placeholder="(11) 99999-9999" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Empresa</Label>
          <Input id="company" name="company" maxLength={160} placeholder="Nome da empresa" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Conte um pouco da sua operação</Label>
        <Textarea
          id="message"
          name="message"
          maxLength={2000}
          rows={4}
          placeholder="Quantas lojas/unidades, quantos usuários, o que você mais precisa resolver..."
        />
      </div>
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? 'Enviando...' : 'Falar com vendas'}
      </Button>
    </form>
  )
}
