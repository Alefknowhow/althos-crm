'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Save, Loader2 } from 'lucide-react'
import {
  upsertCustomerProfile, updateContatoPrimaryContact, addContatoContactPoint,
  removeContatoContactPoint, type ContatoContactPoint,
} from '@/actions/contatos'
import CopyButton from '@/components/ui/copy-button'
import CustomerDocuments, { type CustomerDoc } from '@/components/features/customers/CustomerDocuments'
import { CustomerProfileFormReadView } from './CustomerProfileFormReadView'
import { CustomerProfileFormAddressSection } from './CustomerProfileFormAddressSection'
import { CustomerProfileFormContactSection, CONTACT_LABEL_PRESETS } from './CustomerProfileFormContactSection'
import { CustomerProfileFormDocumentsSection } from './CustomerProfileFormDocumentsSection'

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
  instagram_username?: string | null
  created_at?: string | null
} | null

/** Rótulo com altura fixa — evita que um CopyButton condicional (só aparece
 * com valor preenchido) empurre o input de uma coluna pra baixo em relação
 * às colunas vizinhas sem o botão. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="h-5 flex items-center gap-1.5">{children}</div>
}

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
    instagram_username: initial?.instagram_username || '',
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
    } catch {
      toast.error('Falha ao consultar CEP')
    } finally {
      setCepLoading(false)
    }
  }

  // Único botão de salvar pro cadastro inteiro — segurança contra edição
  // acidental (nada grava sozinho enquanto a pessoa digita).
  async function save() {
    setSaving(true)
    const { email, phone, instagram_username, name, ...rest } = form
    const payload = name.trim() ? { name: name.trim(), ...rest } : rest
    const [profileRes, contactRes] = await Promise.all([
      upsertCustomerProfile(orgSlug, leadId, payload),
      updateContatoPrimaryContact(orgSlug, leadId, { email, phone, instagram_username }),
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
        <DialogHeader><DialogTitle>Gestão de documentos</DialogTitle></DialogHeader>
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
    return (
      <>
      <CustomerProfileFormReadView
        orgSlug={orgSlug}
        form={form}
        points={points}
        initialDocuments={initialDocuments}
        onEdit={() => setEditing(true)}
        onManageDocs={() => setDocsDialogOpen(true)}
      />
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

        <CustomerProfileFormContactSection
          form={{ email: form.email, phone: form.phone, instagram_username: form.instagram_username }}
          setForm={updater => setForm(f => ({ ...f, ...updater(f) }))}
          points={points}
          onRemovePoint={handleRemovePoint}
          newKind={newKind}
          setNewKind={setNewKind}
          newLabel={newLabel}
          setNewLabel={setNewLabel}
          newValue={newValue}
          setNewValue={setNewValue}
          addingPoint={addingPoint}
          onAddPoint={handleAddPoint}
        />

        <CustomerProfileFormDocumentsSection
          orgSlug={orgSlug}
          form={{ cpf: form.cpf, rg: form.rg, passport_number: form.passport_number, passport_expiry: form.passport_expiry, has_us_visa: form.has_us_visa }}
          setForm={updater => setForm(f => ({ ...f, ...updater(f) }))}
          initialDocuments={initialDocuments}
          onManageDocs={() => setDocsDialogOpen(true)}
        />

        <CustomerProfileFormAddressSection
          form={form}
          setForm={updater => setForm(f => ({ ...f, ...updater(f) }))}
          cepLoading={cepLoading}
          onLookupCep={lookupCep}
        />

        {/* Data de registro — automática, somente leitura. Não é um campo do
            form (não faz parte de `form`/`save`), só exibe initial.created_at. */}
        {initial?.created_at && (
          <div className="text-[11px] text-muted-foreground text-right">
            Cliente registrado em {new Date(initial.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

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
