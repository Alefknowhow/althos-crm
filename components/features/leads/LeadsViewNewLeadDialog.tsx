'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AlertTriangle, Plus } from 'lucide-react'
import { createLead, findDuplicateLead } from '@/actions/contatos'
import type { Stage } from './LeadsViewShared'

/* -------- New lead dialog with duplicate detection -------- */

export default function NewLeadDialog({ orgSlug, stages }: { orgSlug: string; stages: Stage[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const router = useRouter()

  // Debounced duplicate check.
  useEffect(() => {
    if (!email && !phone) {
      setDuplicate(null)
      return
    }
    const t = setTimeout(async () => {
      const res = await findDuplicateLead(orgSlug, { email, phone })
      setDuplicate(res.match || null)
    }, 400)
    return () => clearTimeout(t)
  }, [email, phone, orgSlug])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    const result = await createLead(orgSlug, formData)
    setLoading(false)
    if (!result.ok) {
      setError(result.error || 'Erro')
    } else {
      setOpen(false)
      setEmail('')
      setPhone('')
      setDuplicate(null)
      toast.success('Lead criado')
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Novo Lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              name="phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
          {duplicate && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <strong>Lead já existe:</strong> {duplicate.name}.
                <br />
                <Link
                  href={`/app/${orgSlug}/contatos/${duplicate.id}`}
                  className="underline text-amber-800 dark:text-amber-300"
                >
                  Abrir lead existente
                </Link>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="stage_id">Estágio</Label>
            <select
              name="stage_id"
              className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
            >
              <option value="">(Padrão)</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="value_cents">Valor (centavos)</Label>
              <Input id="value_cents" name="value_cents" type="number" min="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (vírgula)</Label>
              <Input id="tags" name="tags" placeholder="urgente, b2b" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
