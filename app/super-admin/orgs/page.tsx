import { getAllOrganizations } from '@/actions/super-admin'
import OrgTable from './OrgTable'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function SuperAdminOrgsPage() {
  const orgs = await getAllOrganizations()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Organizações</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie planos, limites e acesse qualquer organização.
          </p>
        </div>
        <Link href="/super-admin/activate">
          <Button className="bg-violet-600 hover:bg-violet-500 text-white gap-2 h-9">
            <Plus className="w-4 h-4" /> Novo Cliente
          </Button>
        </Link>
      </div>

      <OrgTable orgs={orgs} />
    </div>
  )
}
