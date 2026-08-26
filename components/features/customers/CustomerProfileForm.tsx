'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Save, Loader2, Plus, X, Mail, Phone, Pencil, Upload, FileText, FileImage } from 'lucide-react'
import {
  upsertCustomerProfile, updateContatoPrimaryContact, addContatoContactPoint,
  removeContatoContactPoint, type ContatoContactPoint,
} from '@/actions/contatos'
import CopyButton from '@/components/ui/copy-button'
import CustomerDocuments, { type CustomerDoc } from '@/components/features/customers/CustomerDocuments'
import { formatPhoneDisplay } from '@/lib/utils'

const DOC_KIND_LABEL: Record<string, string> = {
  cpf: 'CPF',
  rg_front: 'RG (frente)',
  rg_back: 'RG (verso)',
  cnh: 'CNH',
  passport: 'Passaporte',
  visa: 'Visto',
  address_proof: 'Comprovante de endereço',
  contract: 'Contrato',
  other: 'Outro',
}

/** Tira horizontal, compacta, só pra visualizar o que já foi anexado — a
 *  gestão (enviar/excluir) mora no popup "Upload de documentos". */
function DocumentsStrip({ documents, onManage }: { documents: CustomerDoc[]; onManage: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {documents.length === 0 ? (
        <span className="text-xs text-muted-foreground">Nenhum documento anexado.</span>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {documents.map(doc => {
            const isImage = (doc.mime_type || '').startsWith('image/')
            return (
              <button
                key={doc.id}
                type="button"
                onClick={onManage}
                title={DOC_KIND_LABEL[doc.kind] || doc.kind}
                className="shrink-0 w-14 h-14 rounded-md border bg-muted flex flex-col items-center justify-center gap-0.5 hover:border-primary/50 hover:bg-muted/70 transition-colors"
              >
                {isImage ? <FileImage className="w-5 h-5 text-muted-foreground/60" /> : <FileText className="w-5 h-5 text-muted-foreground/60" />}
                <span className="text-[8px] font-medium text-muted-foreground/80 truncate max-w-[52px]">
                  {DOC_KIND_LABEL[doc.kind] || doc.kind}
                </span>
              </button>
            )
          })}
        </div>
      )}
      <Button type="button" size="sm" variant="outline" onClick={onManage}>
        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload de documentos
      </Button>
    </div>
  )
}

// Campos de digitação desta tela ganham um fundo mais escuro no dark mode
// pra destacar visualmente a área preenchível dentro dos blocos com borda.
const DARK_FIELD = 'dark:bg-black/40 dark:border-white/10'

type Profile = {
  name?: string | null
  cpf: string | null
  rg: string | null
  passport_number: string | null
  passport_expiry: string | null
  has_us_visa: boolean | null
  date_of_birth: string | null
  postal_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  country: string | null
  address_notes: string | null
  email?: string | null
  phone?: string | null
} | null

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  let out = d
  if (d.length > 9) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  else if (d.length > 6) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  else if (d.length > 3) out = `${d.slice(0, 3)}.${d.slice(3)}`
  return out
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Rótulo com altura fixa — evita que um CopyButton condicional (só aparece
 * com valor preenchido) empurre o input de uma coluna pra baixo em relação
 * às colunas vizinhas sem o botão. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="h-5 flex items-center gap-1.5">{children}</div>
}

const CONTACT_LABEL_PRESETS = ['Trabalho', 'Pessoal', 'Outro']

export default function CustomerProfileForm({
  orgSlug,
  leadId,
  initial,
  initialContactPoints,
  initialDocuments,
  initialEditMode,
}: {
  orgSlug: string
  leadId: string
  initial: Profile
  initialContactPoints: ContatoContactPoint[]
  initialDocuments: CustomerDoc[]
  initialEditMode?: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [editing, setEditing] = useState(!!initialEditMode)
  const [docsDialogOpen, setDocsDialogOpen] = useState(false)

  useEffect(() => {
    if (initialEditMode) setEditing(true)
  }, [initialEditMode])

  const [form, setForm] = useState({
    name: initial?.name || '',
    date_of_birth: initial?.date_of_birth || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    cpf: initial?.cpf || '',
    rg: initial?.rg || '',
    passport_number: initial?.passport_number || '',
    passport_expiry: initial?.passport_expiry || '',
    has_us_visa: initial?.has_us_visa ?? false,
    postal_code: initial?.postal_code || '',
    street: initial?.street || '',
    number: initial?.number || '',
    complement: initial?.complement || '',
    district: initial?.district || '',
    city: initial?.city || '',
    state: initial?.state || '',
    country: initial?.country || 'BR',
    address_notes: initial?.address_notes || '',
  })

  const [points, setPoints] = useState<ContatoContactPoint[]>(initialContactPoints)
  const [newKind, setNewKind] = useState<'email' | 'phone'>('phone')
  const [newLabel, setNewLabel] = useState(CONTACT_LABEL_PRESETS[0])
  const [newValue, setNewValue] = useState('')
  const [addingPoint, setAddingPoint] = useState(false)

  /**
   * ViaCEP free public API — given a CEP (digits only), fills street, district,
   * city, state. Fails silently so the operator can still type by hand if
   * the service is down.
   */
  async function lookupCep() {
    const digits = form.postal_code.replace(/\D/g, '')
    if (digits.length !== 8) {
      toast.error('CEP precisa ter 8 dígitos')
      return
    }
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) {
        toast.error('CEP não encontrado')
        return
      }
      setForm(f => ({
        ...f,
        street: data.logradouro || f.street,
        district: data.bairro || f.district,
        city: data.localidade || f.city,
        state: data.uf || f.state,
      }))
      toast.success('Endereço preenchido')
    } catch (e: any) {
      toast.error('Falha ao consultar CEP')
    } finally {
      setCepLoading(false)
    }
  }

  // Único botão de salvar pro cadastro inteiro — segurança contra edição
  // acidental (nada grava sozinho enquanto a pessoa digita).
  async function save() {
    setSaving(true)
    const { email, phone, name, ...rest } = form
    const payload = name.trim() ? { name: name.trim(), ...rest } : rest
    const [profileRes, contactRes] = await Promise.all([
      upsertCustomerProfile(orgSlug, leadId, payload),
      updateContatoPrimaryContact(orgSlug, leadId, { email, phone }),
    ])
    setSaving(false)
    if (!profileRes.ok) { toast.error((profileRes as any).error || 'Erro ao salvar'); return }
    if (!contactRes.ok) { toast.error((contactRes as any).error || 'Erro ao salvar contato'); return }
    toast.success('Cadastro salvo')
    setEditing(false)
    startTransition(() => router.refresh())
  }

  async function handleAddPoint() {
    if (!newValue.trim()) { toast.error('Preencha o valor.'); return }
    setAddingPoint(true)
    const res = await addContatoContactPoint(orgSlug, leadId, newKind, newLabel, newValue)
    setAddingPoint(false)
    if (!res.ok) { toast.error((res as any).error || 'Erro ao adicionar'); return }
    setPoints(prev => [...prev, (res as any).point])
    setNewValue('')
  }

  async function handleRemovePoint(id: string) {
    setPoints(prev => prev.filter(p => p.id !== id))
    const res = await removeContatoContactPoint(orgSlug, id)
    if (!res.ok) toast.error((res as any).error || 'Erro ao remover')
  }

  // Popup de gestão de documentos — compartilhado entre a visão de leitura e
  // a de edição (mesmo conteúdo, evita duplicar o Dialog nas duas).
  const docsDialog = (
    <Dialog open={docsDialogOpen} onOpenChange={setDocsDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload de documentos</DialogTitle></DialogHeader>
        <CustomerDocuments
          orgSlug={orgSlug}
          leadId={leadId}
          profileId={leadId}
          initialDocuments={initialDocuments}
        />
      </DialogContent>
    </Dialog>
  )

  if (!editing) {
    const rows: { label: string; value: string }[] = [
      { label: 'Nome completo', value: form.name || '—' },
      { label: 'Nascimento', value: form.date_of_birth || '—' },
      { label: 'E-mail', value: form.email || '—' },
      { label: 'Telefone', value: form.phone ? formatPhoneDisplay(form.phone) : '—' },
      { label: 'CPF', value: form.cpf || '—' },
      { label: 'RG', value: form.rg || '—' },
      { label: 'Nº do passaporte', value: form.passport_number || '—' },
      { label: 'Validade passaporte', value: form.passport_expiry || '—' },
      { label: 'Visto americano', value: form.has_us_visa ? 'Possui' : 'Não possui' },
      {
        label: 'Endereço',
        value: [form.street, form.number, form.complement, form.district, form.city, form.state, form.postal_code]
          .filter(Boolean).join(', ') || '—',
      },
      { label: 'Observações internas', value: form.address_notes || '—' },
    ]
    return (
      <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Cadastro do Cliente</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {rows.map(r => (
              <div key={r.label} className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{r.label}</div>
                <div className="text-sm truncate">{r.value}</div>
              </div>
            ))}
          </div>
          {points.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Outros contatos</div>
              {points.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  {p.kind === 'email' ? <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  {p.label && <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{p.label}</span>}
                  <span className="truncate">{p.kind === 'phone' ? formatPhoneDisplay(p.value) : p.value}</span>
                </div>
              ))}
            </div>
          )}
          <div className="pt-2 border-t space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Documentos</div>
            <DocumentsStrip documents={initialDocuments} onManage={() => setDocsDialogOpen(true)} />
          </div>
        </CardContent>
      </Card>
      {docsDialog}
      </>
    )
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Cadastro do Cliente</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dados do cliente */}
        <div className="rounded-lg border border-border/80 p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
            Dados do cliente
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5 w-64">
              <FieldLabel><Label className="text-xs">Nome completo</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-1.5 w-40">
              <FieldLabel>
                <Label className="text-xs">Nascimento</Label>
                <CopyButton value={form.date_of_birth} label="Data de nascimento" />
              </FieldLabel>
              <Input
                className={DARK_FIELD}
                type="date"
                value={form.date_of_birth}
                onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Contato */}
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
                onChange={e => setForm({ ...form, email: e.target.value })}
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
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
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
                  <button type="button" onClick={() => handleRemovePoint(p.id)} className="shrink-0 text-muted-foreground/60 hover:text-destructive" aria-label="Remover">
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
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPoint() } }}
              />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={handleAddPoint} disabled={addingPoint}>
              {addingPoint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Documentos: CPF/RG/Passaporte/Visto + arquivos anexados */}
        <div className="rounded-lg border border-border/80 p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
            Documentos
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5 w-40">
              <FieldLabel>
                <Label className="text-xs">CPF</Label>
                <CopyButton value={form.cpf} label="CPF" />
              </FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.cpf}
                onChange={e => setForm({ ...form, cpf: maskCpf(e.target.value) })}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5 w-40">
              <FieldLabel><Label className="text-xs">RG</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.rg}
                onChange={e => setForm({ ...form, rg: e.target.value })}
                placeholder="00.000.000-0"
              />
            </div>
            <div className="space-y-1.5 w-40">
              <FieldLabel><Label className="text-xs">Nº do passaporte</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.passport_number}
                onChange={e => setForm({ ...form, passport_number: e.target.value.toUpperCase() })}
                placeholder="AB123456"
              />
            </div>
            <div className="space-y-1.5 w-40">
              <FieldLabel><Label className="text-xs">Validade passaporte</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                type="date"
                value={form.passport_expiry}
                onChange={e => setForm({ ...form, passport_expiry: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel><Label className="text-xs">Visto americano</Label></FieldLabel>
              <label className={`flex items-center gap-2 h-10 px-3 rounded-md border border-input cursor-pointer ${DARK_FIELD}`}>
                <input
                  type="checkbox"
                  className="accent-primary w-4 h-4"
                  checked={form.has_us_visa}
                  onChange={e => setForm({ ...form, has_us_visa: e.target.checked })}
                />
                <span className="text-sm">{form.has_us_visa ? 'Possui' : 'Não possui'}</span>
              </label>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border/60">
            <DocumentsStrip documents={initialDocuments} onManage={() => setDocsDialogOpen(true)} />
          </div>
        </div>

        {/* Endereço */}
        <div className="rounded-lg border border-border/80 p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
            Endereço
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5 w-36">
              <FieldLabel><Label className="text-xs">CEP</Label></FieldLabel>
              <div className="flex gap-1">
                <Input
                  className={DARK_FIELD}
                  value={form.postal_code}
                  onChange={e => setForm({ ...form, postal_code: maskCep(e.target.value) })}
                  placeholder="00000-000"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={lookupCep}
                  disabled={cepLoading}
                  title="Buscar endereço pelo CEP"
                  className="shrink-0 px-2"
                >
                  {cepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[220px]">
              <FieldLabel><Label className="text-xs">Rua / Logradouro</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.street}
                onChange={e => setForm({ ...form, street: e.target.value })}
                placeholder="Rua das Acácias"
              />
            </div>
            <div className="space-y-1.5 w-20">
              <FieldLabel><Label className="text-xs">Número</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.number}
                onChange={e => setForm({ ...form, number: e.target.value })}
                placeholder="123"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[160px]">
              <FieldLabel><Label className="text-xs">Complemento</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.complement}
                onChange={e => setForm({ ...form, complement: e.target.value })}
                placeholder="Apto 502, Bloco B"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[160px]">
              <FieldLabel><Label className="text-xs">Bairro</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.district}
                onChange={e => setForm({ ...form, district: e.target.value })}
                placeholder="Centro"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[160px]">
              <FieldLabel><Label className="text-xs">Cidade</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="Itajaí"
              />
            </div>
            <div className="space-y-1.5 w-16">
              <FieldLabel><Label className="text-xs">UF</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.state}
                onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
                placeholder="SC"
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5 w-20">
              <FieldLabel><Label className="text-xs">País</Label></FieldLabel>
              <Input
                className={DARK_FIELD}
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 2) })}
                placeholder="BR"
                maxLength={2}
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="rounded-lg border border-border/80 p-3.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
            Observações internas
          </div>
          <Textarea
            className={DARK_FIELD}
            rows={3}
            value={form.address_notes}
            onChange={e => setForm({ ...form, address_notes: e.target.value })}
            placeholder="Preferências, restrições, contexto pra futuro contato..."
          />
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" /> Salvar alterações
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
    {docsDialog}
    </>
  )
}
