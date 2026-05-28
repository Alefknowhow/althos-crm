'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { activateManagedOrganization } from '@/actions/super-admin'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'

export default function ActivateManagedOrgPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await activateManagedOrganization(formData)
      if (res.ok) {
        toast.success('Organização ativada e convite enviado!')
        router.push('/super-admin/orgs')
      } else {
        toast.error(res.error || 'Erro ao ativar organização')
      }
    } catch {
      toast.error('Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-violet-950 border border-violet-800 flex items-center justify-center">
          <UserPlus className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Ativar Novo Cliente</h1>
          <p className="text-sm text-slate-500">Cria a org, o usuário e envia o link de primeiro acesso.</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-slate-400 text-xs">Nome da Empresa</Label>
            <Input
              id="name" name="name"
              placeholder="Ex: Clínica ABC"
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-400 text-xs">E-mail do Responsável</Label>
            <Input
              id="email" name="email" type="email"
              placeholder="dono@empresa.com"
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Plano</Label>
            <Select name="tier" defaultValue="althos_starter">
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Selecione o tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="althos_starter">Althos Starter — 500 leads</SelectItem>
                <SelectItem value="althos_growth">Althos Growth — 2.500 leads</SelectItem>
                <SelectItem value="althos_performance">Althos Performance — 50.000 leads</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-slate-400 text-xs">Notas Internas</Label>
            <Textarea
              id="notes" name="notes"
              placeholder="Detalhes do contrato, SLA, observações…"
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white"
          >
            {loading ? 'Ativando…' : 'Ativar e Enviar Convite'}
          </Button>
        </form>
      </div>
    </div>
  )
}
