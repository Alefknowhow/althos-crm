import { cookies } from 'next/headers'
import { exitImpersonation } from '@/actions/super-admin'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function ImpersonationBanner() {
  const impersonatedOrgId = cookies().get('impersonated_org_id')?.value

  if (!impersonatedOrgId) return null

  const supabase = createClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', impersonatedOrgId)
    .single()

  if (!org) return null

  return (
    <div className="bg-amber-100 border-b border-amber-200 py-2 px-4 flex items-center justify-center gap-4 text-amber-900 text-sm font-medium">
      <Lock className="w-4 h-4" />
      <span>
        🔒 Você está acessando <strong>{org.name}</strong> como super admin.
      </span>
      <form action={exitImpersonation}>
        <Button 
          variant="link" 
          size="sm" 
          className="text-amber-900 font-bold underline p-0 h-auto hover:text-amber-700"
        >
          Sair desse modo
        </Button>
      </form>
    </div>
  )
}
