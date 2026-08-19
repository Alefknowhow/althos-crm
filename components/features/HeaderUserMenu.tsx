'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { logout } from '@/actions/auth'
import UserAvatar from './UserAvatar'

interface Props {
  orgSlug: string
  name: string
  email: string
  avatarUrl: string | null
}

/** Menu do usuário logado — canto direito do header (desktop). Mesma
 *  ação de SidebarUserMenu.tsx (que continua existindo só pro drawer
 *  mobile, via md:hidden em Sidebar.tsx — esse aqui é a versão
 *  desktop, "por enquanto", conforme pedido). */
export default function HeaderUserMenu({ orgSlug, name, email, avatarUrl }: Props) {
  const [open, setOpen] = useState(false)
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
        className="flex items-center gap-1.5 rounded-md pl-1 pr-1.5 py-1 hover:bg-muted transition-colors"
      >
        <UserAvatar name={name} email={email} avatarUrl={avatarUrl} size={28} />
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-none overflow-hidden z-50 shadow-md">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-xs font-semibold truncate">{name || 'Usuário'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{email}</p>
          </div>

          <Link
            href={`/app/${orgSlug}/perfil`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            <User className="w-4 h-4 text-muted-foreground" />
            Meu perfil
          </Link>

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
    </div>
  )
}
