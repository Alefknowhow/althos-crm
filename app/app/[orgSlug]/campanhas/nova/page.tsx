import { requireAuth } from '@/lib/supabase/types'
import { getPipelinesAndStages } from '@/actions/pipeline'
import { listDistinctTags, listSelectableWaTemplates } from '@/actions/send-campaigns'
import { listEmailTemplates } from '@/actions/emails'
import NewCampaignForm from '@/components/features/campaigns/NewCampaignForm'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { MessageSquare, Mail } from 'lucide-react'

export default async function NovaCampanhaPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()

  const [{ pipelines, stages }, tags, waTemplates, emailTemplates] = await Promise.all([
    getPipelinesAndStages(params.orgSlug),
    listDistinctTags(params.orgSlug),
    listSelectableWaTemplates(params.orgSlug),
    listEmailTemplates(params.orgSlug),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Nova campanha</h1>
          <p className="text-sm text-muted-foreground">Escolha o canal, o público e o template.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/app/${params.orgSlug}/whatsapp-templates`}>
              <MessageSquare className="w-3.5 h-3.5" />
              Templates WhatsApp
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/app/${params.orgSlug}/email-templates`}>
              <Mail className="w-3.5 h-3.5" />
              Templates E-mail
            </Link>
          </Button>
        </div>
      </div>
      <NewCampaignForm
        orgSlug={params.orgSlug}
        pipelines={pipelines}
        stages={stages}
        tags={tags}
        waTemplates={waTemplates}
        emailTemplates={emailTemplates}
      />
    </div>
  )
}
