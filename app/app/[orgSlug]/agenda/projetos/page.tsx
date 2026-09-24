import { notFound } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { listProjects } from '@/actions/projects'
import { listOrgMembers } from '@/actions/team'
import { PageHeader } from '@/components/ui/page-header'
import ProjectsView from '@/components/features/agenda/projetos/ProjectsView'

export const dynamic = 'force-dynamic'

// Agenda → Projetos (issue #14) — generalizado pra qualquer nicho, não
// exclusivo mais de Agências de Tráfego (sem requireModuleEnabled aqui).
// Gate por permissão aqui é obrigatório: esconder o link na sidebar não é
// autorização — acesso direto pela URL bypassava a checagem (achado da
// revisão automática do PR #53).
export default async function ProjetosPage({ params }: { params: { orgSlug: string } }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'projects')
  if (!perm.allowed) notFound()

  const supabase = createClient()

  const [{ data: clients }, members, projects] = await Promise.all([
    supabase.from('contatos').select('id, name').eq('organization_id', org.id).eq('status', 'cliente').order('name'),
    listOrgMembers(params.orgSlug),
    listProjects(params.orgSlug),
  ])

  const memberName = new Map(members.map((m: any) => [m.user_id, m.name]))
  const enriched = projects.map(p => ({
    ...p,
    owner: p.owner_id ? { id: p.owner_id, name: memberName.get(p.owner_id) || null, email: null } : null,
  }))

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Projetos"
        hint="O que estamos executando agora — organizado por iniciativa e alimentado pelas mesmas Tasks do CRM."
      />
      <ProjectsView
        orgSlug={params.orgSlug}
        projects={enriched as any}
        clients={(clients || []) as any}
        members={members as any}
      />
    </div>
  )
}
