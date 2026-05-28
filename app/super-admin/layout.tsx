import { isSuperAdmin } from '@/lib/supabase/types'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Building2,
  ScrollText,
  UserPlus,
  ArrowLeft,
  ShieldCheck,
  Link2,
} from 'lucide-react'

const NAV = [
  { href: '/super-admin',            label: 'Visão Geral',    icon: LayoutDashboard },
  { href: '/super-admin/orgs',       label: 'Organizações',   icon: Building2 },
  { href: '/super-admin/convites',   label: 'Convites',       icon: Link2 },
  { href: '/super-admin/audit',      label: 'Auditoria',      icon: ScrollText },
  { href: '/super-admin/activate',   label: 'Novo Cliente',   icon: UserPlus },
]

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const superAdmin = await isSuperAdmin()
  if (!superAdmin) notFound()

  return (
    <div className="flex min-h-screen bg-[#0f0f11]">

      {/* ---- Sidebar ---- */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-white/10 bg-[#0f0f11]">
        {/* Brand */}
        <div className="h-14 flex items-center gap-2 px-4 border-b border-white/10">
          <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">Super Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <Link
            href="/app"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao App
          </Link>
        </div>
      </aside>

      {/* ---- Main ---- */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center px-6 border-b border-white/10 bg-[#0f0f11]">
          <p className="text-xs text-slate-500 font-mono">althos.io / super-admin</p>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 bg-[#0f0f11]">
          {children}
        </main>
      </div>

    </div>
  )
}
