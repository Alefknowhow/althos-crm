import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listKnowledge } from '@/actions/ai_attendant'
import KnowledgeManager from '@/components/features/ai/KnowledgeManager'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function FaqPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const items = await listKnowledge(params.orgSlug)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href={`/app/${params.orgSlug}/configuracoes/atendente-ia`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-3 h-3" /> Atendente IA
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Base de Conhecimento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cada entrada Q&A é injetada no contexto do atendente. Use para preços, procedimentos,
          horários, políticas — qualquer info que a IA precisa saber para responder bem.
        </p>
      </div>

      <KnowledgeManager orgSlug={params.orgSlug} initial={items} />
    </div>
  )
}
