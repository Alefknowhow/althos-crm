import { listConversations, getConversationMessages } from '@/actions/social-inbox'
import { getCurrentOrganization } from '@/lib/supabase/types'
import SocialInbox from '@/components/features/social/SocialInbox'

export const dynamic = 'force-dynamic'

export default async function SocialInboxPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { id?: string }
}) {
  const org = await getCurrentOrganization(params.orgSlug)
  const conversations = await listConversations(params.orgSlug)
  const selectedConversation = searchParams.id
    ? conversations.find(c => c.id === searchParams.id) || null
    : null
  const messages = selectedConversation
    ? await getConversationMessages(params.orgSlug, selectedConversation.id)
    : []

  return (
    <div className="h-full flex bg-background overflow-hidden">
      <SocialInbox
        orgSlug={params.orgSlug}
        orgId={org.id}
        conversations={conversations}
        selectedConversation={selectedConversation}
        initialMessages={messages}
      />
    </div>
  )
}
