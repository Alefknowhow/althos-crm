import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getProject, listProjectGroups } from '@/actions/projects'
import { listTasksForProject } from '@/actions/tasks'
import { listOrgMembers } from '@/actions/team'
import ProjectDetailShell from '@/components/features/agenda/projetos/ProjectDetailShell'

export const dynamic = 'force-dynamic'

export default async function ProjetoDetailPage({ params }: { params: { orgSlug: string; id: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const project = await getProject(params.orgSlug, params.id)
  if (!project) redirect(`/app/${params.orgSlug}/agenda/projetos`)

  const [groups, tasks, members] = await Promise.all([
    listProjectGroups(params.orgSlug, params.id),
    listTasksForProject(params.orgSlug, params.id),
    listOrgMembers(params.orgSlug),
  ])

  const memberName = new Map(members.map((m: any) => [m.user_id, m.name]))
  const owner = project!.owner_id ? { id: project!.owner_id, name: memberName.get(project!.owner_id) || null, email: null } : null

  return (
    <ProjectDetailShell
      orgSlug={params.orgSlug}
      project={{ ...(project as any), owner }}
      groups={groups as any}
      tasks={tasks as any}
      members={members as any}
    />
  )
}
