import { listConversations, getConversationMessages } from '@/actions/social-inbox'
import SocialInbox from '@/components/features/social/SocialInbox'

export const dynamic = 'force-dynamic'

export default async function SocialInboxPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { id?: string }
}) {
  const conversations = await listConversations(params.orgSlug)
  const selectedConversation = searchParams.id
    ? conversations.find(c => c.id === searchParams.id) || null
    : null
  const messages = selectedConversation
    ? await getConversationMessages(params.orgSlug, selectedConversation.id)
    : []

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex bg-background overflow-hidden">
      <SocialInbox
        orgSlug={params.orgSlug}
        conversations={conversations}
        selectedConversation={selectedConversation}
        initialMessages={messages}
      />
    </div>
  )
}
