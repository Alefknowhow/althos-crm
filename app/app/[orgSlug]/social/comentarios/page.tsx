import { listPendingComments } from '@/actions/social-comments'
import { getCurrentOrganization } from '@/lib/supabase/types'
import CommentsInbox from '@/components/features/social/CommentsInbox'

export const dynamic = 'force-dynamic'

export default async function SocialCommentsPage({ params }: { params: { orgSlug: string } }) {
  const [org, comments] = await Promise.all([
    getCurrentOrganization(params.orgSlug),
    listPendingComments(params.orgSlug),
  ])

  return (
    <div className="h-full overflow-y-auto bg-background">
      <CommentsInbox orgSlug={params.orgSlug} orgId={org.id} initialComments={comments} />
    </div>
  )
}
