import { getDisabledModules } from '@/lib/module-flags'
import { NICHE_MODULE_GROUPS } from '@/lib/niche-modules'
import ModuleFlagsEditor from './ModuleFlagsEditor'

export const dynamic = 'force-dynamic'

export default async function ModulosPage() {
  const disabled = await getDisabledModules()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Módulos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Liga/desliga módulos globalmente por nicho — útil pra manter algo em desenvolvimento fora do ar até estar pronto,
          independente do que cada organização já tem configurado.
        </p>
      </div>

      <ModuleFlagsEditor groups={NICHE_MODULE_GROUPS} disabled={disabled} />
    </div>
  )
}
