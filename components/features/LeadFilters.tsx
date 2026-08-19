'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createLead } from '@/actions/contatos'

export default function LeadFilters({ orgSlug, stages, isCreateOnly = false }: { orgSlug: string, stages: any[], isCreateOnly?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (search) params.set('q', search)
      else params.delete('q')
      router.push(`/app/${orgSlug}/contatos?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, router, orgSlug, searchParams])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    // Radix Select não aceita item com value="" — o sentinel abaixo
    // representa "(Padrão)", que a action espera como campo ausente/vazio.
    if (formData.get('stage_id') === '__default__') formData.set('stage_id', '')
    const result = await createLead(orgSlug, formData)
    setLoading(false)
    if (!result.ok) {
      setError(result.error || 'Erro')
    } else {
      setOpen(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      {!isCreateOnly && (
        <Input 
          placeholder="Buscar por nome, email..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      )}
      
      <Button onClick={() => setOpen(true)}>+ Novo Lead</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {error && <div className="text-sm text-destructive mb-4">{error}</div>}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage_id">Estágio</Label>
                <Select name="stage_id" defaultValue="__default__">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">(Padrão)</SelectItem>
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="value_cents">Valor (em centavos, ex: 10000 = R$ 100,00)</Label>
                <Input id="value_cents" name="value_cents" type="number" min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                <Input id="tags" name="tags" placeholder="urgente, b2b" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
