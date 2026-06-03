import { getPlatformUsers } from '@/actions/super-admin'
import UsersTable from './UsersTable'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const users = await getPlatformUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Usuários</h1>
        <p className="text-sm text-slate-500 mt-1">
          Todos os usuários da plataforma, suas contas e acesso de super admin.
        </p>
      </div>
      <UsersTable users={users} />
    </div>
  )
}
