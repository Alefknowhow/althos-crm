'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, X, Mail, Phone, AtSign, ExternalLink } from 'lucide-react'
import CopyButton from '@/components/ui/copy-button'
import type { ContatoContactPoint } from '@/actions/contatos'

const DARK_FIELD = 'dark:bg-black/40 dark:border-white/10'

/** Rótulo com altura fixa — evita que um CopyButton condicional (só aparece
 * com valor preenchido) empurre o input de uma coluna pra baixo em relação
 * às colunas vizinhas sem o botão. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="h-5 flex items-center gap-1.5">{children}</div>
}

export const CONTACT_LABEL_PRESETS = ['Trabalho', 'Pessoal', 'Outro']

type ContactForm = {
  email:               string
  phone:               string
  instagram_username:  string
}

export function CustomerProfileFormContactSection({
  form,
  setForm,
  points,
  onRemovePoint,
  newKind,
  setNewKind,
  newLabel,
  setNewLabel,
  newValue,
  setNewValue,
  addingPoint,
  onAddPoint,
}: {
  form:          ContactForm
  setForm:       (updater: (f: ContactForm) => ContactForm) => void
  points:        ContatoContactPoint[]
  onRemovePoint: (id: string) => void
  newKind:       'email' | 'phone'
  setNewKind:    (k: 'email' | 'phone') => void
  newLabel:      string
  setNewLabel:   (l: string) => void
  newValue:      string
  setNewValue:   (v: string) => void
  addingPoint:   boolean
  onAddPoint:    () => void
}) {
  return (
    <div className="rounded-lg border border-border/80 p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
        Contato
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1.5 w-64">
          <FieldLabel>
            <Label className="text-xs">E-mail</Label>
            <CopyButton value={form.email} label="E-mail" />
          </FieldLabel>
          <Input
            className={DARK_FIELD}
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="cliente@email.com"
          />
        </div>
        <div className="space-y-1.5 w-40">
          <FieldLabel>
            <Label className="text-xs">Telefone</Label>
            <CopyButton value={form.phone} label="Telefone" />
          </FieldLabel>
          <Input
            className={DARK_FIELD}
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="space-y-1.5 w-48">
          <FieldLabel>
            <Label className="text-xs">Instagram</Label>
            {form.instagram_username && (
              <a
                href={`https://instagram.com/${form.instagram_username.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir perfil no Instagram"
                className="text-muted-foreground/60 hover:text-primary"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </FieldLabel>
          <div className="relative">
            <AtSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <Input
              className={`pl-8 ${DARK_FIELD}`}
              value={form.instagram_username}
              onChange={e => setForm(f => ({ ...f, instagram_username: e.target.value }))}
              placeholder="usuario"
            />
          </div>
        </div>
      </div>

      {points.length > 0 && (
        <div className="space-y-1.5 mt-3">
          {points.map(p => (
            <div key={p.id} className="flex items-center gap-2 text-sm rounded-md border px-2.5 py-1.5">
              {p.kind === 'email' ? <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              {p.label && <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{p.label}</span>}
              <span className="flex-1 min-w-0 truncate">{p.value}</span>
              <CopyButton value={p.value} label={p.label || (p.kind === 'email' ? 'E-mail' : 'Telefone')} />
              <button type="button" onClick={() => onRemovePoint(p.id)} className="shrink-0 text-muted-foreground/60 hover:text-destructive" aria-label="Remover">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 mt-3">
        <div className="space-y-1.5 w-28">
          <FieldLabel><Label className="text-xs">Tipo</Label></FieldLabel>
          <Select value={newKind} onValueChange={v => setNewKind(v as 'email' | 'phone')}>
            <SelectTrigger className={`h-9 ${DARK_FIELD}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 w-32">
          <FieldLabel><Label className="text-xs">Rótulo</Label></FieldLabel>
          <Select value={newLabel} onValueChange={setNewLabel}>
            <SelectTrigger className={`h-9 ${DARK_FIELD}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTACT_LABEL_PRESETS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 w-56">
          <FieldLabel><Label className="text-xs">Outro e-mail/telefone</Label></FieldLabel>
          <Input
            className={DARK_FIELD}
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder={newKind === 'email' ? 'outro@email.com' : '(00) 00000-0000'}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddPoint() } }}
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAddPoint} disabled={addingPoint}>
          {addingPoint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  )
}
