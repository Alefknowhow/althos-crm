import { listPendingComments } from '@/actions/social-comments'
import CommentsInbox from '@/components/features/social/CommentsInbox'

export const dynamic = 'force-dynamic'

export default async function SocialCommentsPage({ params }: { params: { orgSlug: string } }) {
  const comments = await listPendingComments(params.orgSlug)

  return (
    <div className="h-full overflow-y-auto bg-background">
      <CommentsInbox orgSlug={params.orgSlug} initialComments={comments} />
    </div>
  )
}
