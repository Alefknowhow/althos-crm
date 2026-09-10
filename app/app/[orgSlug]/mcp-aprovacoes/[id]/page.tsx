import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/server'
import { reviewAgentOperation } from '@/actions/agent-approvals'
import { IRREVERSIBLE_WARNING } from '@/lib/agent/approval'

export const dynamic = 'force-dynamic'

export default async function AgentApprovalPage({ params }: { params: { orgSlug: string; id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound()
  const user = await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const { data, error } = await createAdminClient().from('agent_approval_requests')
    .select('id,tool,preview,status,error,expires_at').eq('id', params.id).eq('organization_id', org.id).eq('user_id', user.id).maybeSingle()
  if (error || !data) notFound()
  const expired = new Date(data.expires_at).getTime() <= Date.now()
  const pending = data.status === 'pending' && !expired
  const status: Record<string, string> = { pending: expired ? 'Expirada' : 'Aguardando sua autorização', executing: 'Em execução — não repita a operação', succeeded: 'Concluída', failed: 'Falhou — confira os dados antes de tentar novamente', rejected: 'Recusada' }
  const action = reviewAgentOperation.bind(null, params.orgSlug, params.id)
  return <main className="mx-auto max-w-3xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Autorizar alteração solicitada no chat</h1>
    <p>Operação: <strong>{data.tool}</strong></p>
    <p role="status">{status[data.status] ?? data.status}</p>
    <p className="font-semibold text-destructive">{IRREVERSIBLE_WARNING}</p>
    <p>Revise o registro, as alterações e os efeitos abaixo. A autorização vale apenas para esta operação e expira após 15 minutos.</p>
    <pre className="overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted p-4 text-sm">{JSON.stringify(data.preview, null, 2)}</pre>
    {data.error && <p role="alert" className="text-destructive">{data.error}</p>}
    {pending && <form action={action} className="space-y-4">
      <label className="flex items-start gap-3"><input type="checkbox" name="understood" value="yes" className="mt-1" />
        <span>Li os dados e compreendo que esta ação não poderá ser desfeita.</span></label>
      <div className="flex gap-3">
        <button type="submit" name="decision" value="approve" className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground">Autorizar e executar</button>
        <button type="submit" name="decision" value="reject" className="rounded-md border px-4 py-2">Recusar</button>
      </div>
    </form>}
    <p className="text-sm text-muted-foreground">Volte ao chat e peça para consultar o resultado desta operação.</p>
  </main>
}
