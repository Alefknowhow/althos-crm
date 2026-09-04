'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import UserAvatar from '@/components/features/UserAvatar'
import {
  updateProfileInfo,
  requestEmailChange,
  uploadUserAvatar,
  removeUserAvatar,
  type UserProfile,
} from '@/actions/profile'
import {
  User,
  Mail,
  CheckCircle2,
  Trash2,
  Camera,
  Loader2,
} from 'lucide-react'
import { Section } from './ProfileSection'
import { ProfileSecuritySection } from './ProfileSecuritySection'
import { ProfileOrganizationsSection } from './ProfileOrganizationsSection'

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProfileClient({
  profile,
  orgSlug,
}: {
  profile: UserProfile
  orgSlug: string
}) {
  const router = useRouter()

  // ── Foto de perfil ────────────────────────────────────────────────────────
  // Mesmo padrão otimista do AvatarUploader de contatos
  // (components/features/contatos/ContatosView.tsx): mostra o preview local
  // (URL.createObjectURL) na hora, troca pela signed URL real quando a
  // action retorna, reverte se der erro.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  async function handleAvatarFile(file: File | undefined) {
    if (!file) return
    setAvatarBusy(true)
    const preview = URL.createObjectURL(file)
    setAvatarUrl(preview)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadUserAvatar(orgSlug, fd)
      if (res.ok) {
        setAvatarUrl(res.url)
        router.refresh()
      } else {
        toast.error(res.error)
        setAvatarUrl(profile.avatar_url)
      }
    } finally {
      URL.revokeObjectURL(preview)
      setAvatarBusy(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setAvatarBusy(true)
    const res = await removeUserAvatar(orgSlug)
    setAvatarBusy(false)
    if (res.ok) {
      setAvatarUrl(null)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  // ── Dados pessoais ───────────────────────────────────────────────────────
  const [name,          setName]          = useState(profile.name)
  const [phone,         setPhone]         = useState(profile.phone)
  const [savingInfo,    setSavingInfo]    = useState(false)

  async function handleSaveInfo() {
    setSavingInfo(true)
    const res = await updateProfileInfo(name, phone)
    if (res.ok) {
      toast.success('Dados atualizados!')
      router.refresh()
    } else {
      toast.error(res.error)
    }
    setSavingInfo(false)
  }

  // ── Troca de e-mail ──────────────────────────────────────────────────────
  const [newEmail,      setNewEmail]      = useState('')
  const [emailSent,     setEmailSent]     = useState(false)
  const [savingEmail,   setSavingEmail]   = useState(false)

  async function handleEmailChange() {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast.error('Informe um e-mail válido.')
      return
    }
    setSavingEmail(true)
    const res = await requestEmailChange(newEmail)
    if (res.ok) {
      setEmailSent(true)
      toast.success('Confirmação enviada! Verifique seu novo e-mail.')
    } else {
      toast.error(res.error)
    }
    setSavingEmail(false)
  }

  const infoChanged = name !== profile.name || phone !== profile.phone

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0 group">
          <UserAvatar name={profile.name} email={profile.email} avatarUrl={avatarUrl} size={56} />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarBusy}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow ring-2 ring-card disabled:opacity-50"
            aria-label="Trocar foto"
          >
            {avatarBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
          {avatarUrl && !avatarBusy && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white grid place-items-center shadow ring-2 ring-card opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remover foto"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => handleAvatarFile(e.target.files?.[0])}
          />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">
            {profile.name || 'Sem nome'}
          </h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      {/* ── Dados pessoais ───────────────────────────────────────────────── */}
      <Section icon={User} title="Dados pessoais">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="João Silva"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <Input
              id="phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(11) 9 9999-9999"
              type="tel"
              className="h-10"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveInfo}
              disabled={savingInfo || !infoChanged}
              size="sm"
              className="min-w-[120px]"
            >
              {savingInfo ? 'Salvando…' : 'Salvar dados'}
            </Button>
          </div>
        </div>
      </Section>

      {/* ── E-mail ───────────────────────────────────────────────────────── */}
      <Section icon={Mail} title="Endereço de e-mail">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{profile.email}</span>
            <Badge variant="outline" className="ml-auto text-[10px]">atual</Badge>
          </div>

          {emailSent ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Um link de confirmação foi enviado para <strong>{newEmail}</strong>.
                O e-mail só será atualizado após você clicar no link.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="new-email">Novo e-mail</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="novo@email.com"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Um link de confirmação será enviado para o novo endereço.
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleEmailChange}
                  disabled={savingEmail || !newEmail.trim()}
                  size="sm"
                  variant="outline"
                  className="min-w-[160px]"
                >
                  {savingEmail ? 'Enviando…' : 'Alterar e-mail'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* ── Segurança ─────────────────────────────────────────────────────── */}
      <ProfileSecuritySection />

      {/* ── Organizações ─────────────────────────────────────────────────── */}
      <ProfileOrganizationsSection profile={profile} orgSlug={orgSlug} />

    </div>
  )
}
