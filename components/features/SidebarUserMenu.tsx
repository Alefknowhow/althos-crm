'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { LogOut, User, ChevronUp } from 'lucide-react'
import { logout } from '@/actions/auth'

function initials(name: string, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(' ')
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email?.[0]?.toUpperCase() ?? '?'
}

interface Props {
  name: string
  email: string
}

export default function SidebarUserMenu({ name, email }: Props) {
  const params = useParams()
  const orgSlug = params?.orgSlug as string | undefined

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const profileHref = orgSlug ? `/app/${orgSlug}/perfil` : '#'

  return (
    <div ref={ref} className="relative">
      {/* Popup menu */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-xs font-semibold truncate">{name || 'Usuário'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{email}</p>
          </div>

          <Link
            href={profileHref}
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

      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors group"
      >
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0">
          {initials(name, email)}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium truncate leading-tight">{name || 'Usuário'}</p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight">{email}</p>
        </div>
        <ChevronUp
          className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  )
}
