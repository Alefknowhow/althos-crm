'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Save, Loader2, Plus, X, Mail, Phone } from 'lucide-react'
import {
  updateContatoPrimaryContact, addContatoContactPoint, removeContatoContactPoint,
  type ContatoContactPoint,
} from '@/actions/contatos'
import CopyButton from '@/components/ui/copy-button'

const LABEL_PRESETS = ['Trabalho', 'Pessoal', 'Financeiro', 'Outro']

export default function CustomerContactForm({
  orgSlug,
  contatoId,
  initialEmail,
  initialPhone,
  initialPoints,
}: {
  orgSlug: string
  contatoId: string
  initialEmail: string | null
  initialPhone: string | null
  initialPoints: ContatoContactPoint[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState(initialEmail || '')
  const [phone, setPhone] = useState(initialPhone || '')
  const [points, setPoints] = useState<ContatoContactPoint[]>(initialPoints)

  const [newKind, setNewKind] = useState<'email' | 'phone'>('phone')
  const [newLabel, setNewLabel] = useState(LABEL_PRESETS[0])
  const [newValue, setNewValue] = useState('')
  const [adding, setAdding] = useState(false)

  async function savePrimary() {
    setSaving(true)
    const res = await updateContatoPrimaryContact(orgSlug, contatoId, { email, phone })
    setSaving(false)
    if (res.ok) {
      toast.success('Contato atualizado')
      startTransition(() => router.refresh())
    } else {
      toast.error((res as any).error || 'Erro ao salvar')
    }
  }

  async function handleAdd() {
    if (!newValue.trim()) { toast.error('Preencha o valor.'); return }
    setAdding(true)
    const res = await addContatoContactPoint(orgSlug, contatoId, newKind, newLabel, newValue)
    setAdding(false)
    if (!res.ok) { toast.error((res as any).error || 'Erro ao adicionar'); return }
    setPoints(prev => [...prev, (res as any).point])
    setNewValue('')
  }

  async function handleRemove(id: string) {
    setPoints(prev => prev.filter(p => p.id !== id))
    const res = await removeContatoContactPoint(orgSlug, id)
    if (!res.ok) toast.error((res as any).error || 'Erro ao remover')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contato</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Principal */}
        <div className="rounded-lg border border-border/80 p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
            Principal
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 flex-1 min-w-[220px]">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">E-mail</Label>
                <CopyButton value={email} label="E-mail" />
              </div>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>
            <div className="space-y-1.5 w-48">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Telefone</Label>
                <CopyButton value={phone} label="Telefone" />
              </div>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <Button size="sm" onClick={savePrimary} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Pontos de contato adicionais */}
        <div className="rounded-lg border border-border/80 p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
            Outros e-mails/telefones
          </div>

          {points.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {points.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm rounded-md border px-3 py-1.5">
                  {p.kind === 'email' ? <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  {p.label && <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{p.label}</span>}
                  <span className="flex-1 min-w-0 truncate">{p.value}</span>
                  <CopyButton value={p.value} label={p.label || (p.kind === 'email' ? 'E-mail' : 'Telefone')} />
                  <button
                    type="button"
                    onClick={() => handleRemove(p.id)}
                    className="shrink-0 text-muted-foreground/60 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5 w-28">
              <Label className="text-xs">Tipo</Label>
              <Select value={newKind} onValueChange={v => setNewKind(v as 'email' | 'phone')}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-32">
              <Label className="text-xs">Rótulo</Label>
              <Select value={newLabel} onValueChange={setNewLabel}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LABEL_PRESETS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <Label className="text-xs">Valor</Label>
              <Input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder={newKind === 'email' ? 'outro@email.com' : '(00) 00000-0000'}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
