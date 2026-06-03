import { getSystemConfig } from '@/actions/super-admin'
import ConfigEditor from './ConfigEditor'
import Link from 'next/link'
import { Settings2, UserPlus, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const config = await getSystemConfig()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">Parâmetros globais da plataforma.</p>
      </div>

      {/* Quick action: manual activation */}
      <Link
        href="/super-admin/activate"
        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] transition-colors"
      >
        <div className="w-9 h-9 rounded-md bg-violet-600/20 flex items-center justify-center shrink-0">
          <UserPlus className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Ativar novo cliente</p>
          <p className="text-xs text-slate-500">Criar conta gerenciada e enviar acesso por e-mail.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-500" />
      </Link>

      {/* System config */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-white">Parâmetros do sistema</h2>
        </div>
        {config.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Nenhum parâmetro configurado.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {config.map(row => (
              <ConfigEditor key={row.key} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
