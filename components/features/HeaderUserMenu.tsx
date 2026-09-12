'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { LogOut, User, ChevronDown, CreditCard, Crown, Gem, Star } from 'lucide-react'
import { logout } from '@/actions/auth'
import UserAvatar from './UserAvatar'
import ProfileSheet from './ProfileSheet'
import type { PlanKey } from '@/lib/billing/plans-data'

interface Props {
  orgSlug: string
  name: string
  email: string
  avatarUrl: string | null
  isOwner?: boolean
  planKey?: PlanKey
  planLabel?: string
}

/** Selo do plano contratado, sobreposto no canto do avatar — quanto mais alto
 *  o plano, mais "premium" o ícone (pedido explícito: Pro ganha coroa). Free/
 *  trial/agency/internal não têm badge (não é um plano pago que vale exibir). */
function PlanBadge({ planKey }: { planKey?: PlanKey }) {
  if (!planKey) return null
  if (planKey === 'starter') {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-400 ring-2 ring-background">
        <Star className="h-2 w-2 text-white" fill="currentColor" />
      </span>
    )
  }
  if (planKey === 'pro') {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background">
        <Crown className="h-2 w-2 text-white" fill="currentColor" />
      </span>
    )
  }
  if (planKey === 'business' || planKey === 'scale') {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-500 ring-2 ring-background">
        <Gem className="h-2 w-2 text-white" fill="currentColor" />
      </span>
    )
  }
  return null
}

/** Menu do usuário logado — canto direito do header (desktop). Mesma
 *  ação de SidebarUserMenu.tsx (que continua existindo só pro drawer
 *  mobile, via md:hidden em Sidebar.tsx — esse aqui é a versão
 *  desktop, "por enquanto", conforme pedido). */
export default function HeaderUserMenu({ orgSlug, name, email, avatarUrl, isOwner, planKey, planLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-md pl-1 pr-2 py-1 hover:bg-muted transition-colors max-w-[160px]"
      >
        <span className="relative shrink-0">
          <UserAvatar name={name} email={email} avatarUrl={avatarUrl} size={28} />
          <PlanBadge planKey={planKey} />
        </span>
        <span className="text-xs font-medium truncate">{name || 'Usuário'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-none overflow-hidden z-50 shadow-md">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-xs font-semibold truncate">{name || 'Usuário'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{email}</p>
            {planLabel && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {planKey === 'pro' && <Crown className="h-2.5 w-2.5 text-amber-500" fill="currentColor" />}
                {(planKey === 'business' || planKey === 'scale') && <Gem className="h-2.5 w-2.5 text-violet-500" fill="currentColor" />}
                {planKey === 'starter' && <Star className="h-2.5 w-2.5 text-slate-400" fill="currentColor" />}
                Plano {planLabel}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); setProfileOpen(true) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            <User className="w-4 h-4 text-muted-foreground" />
            Meu perfil
          </button>

          {isOwner && (
            <Link
              href={`/app/${orgSlug}/assinatura`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Assinatura
            </Link>
          )}

          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </form>
        </div>
      )}

      <ProfileSheet orgSlug={orgSlug} open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  )
}
