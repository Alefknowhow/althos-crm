import { listPlatformSubscriptions, getPlatformCostSummary } from '@/actions/platform-subscriptions'
import PlataformaClient from './PlataformaClient'
import { ServerCog } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlataformaPage() {
  const [subscriptions, summary] = await Promise.all([
    listPlatformSubscriptions(),
    getPlatformCostSummary(),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <ServerCog className="w-5 h-5 text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Infra &amp; Assinaturas</h1>
          <p className="text-sm text-slate-500 mt-1">Custos operacionais da plataforma — Supabase, Vercel, Resend, Inngest, Cloudflare e tokens de IA (Claude/Gemini).</p>
        </div>
      </div>

      <PlataformaClient initialSubscriptions={subscriptions} initialSummary={summary} />
    </div>
  )
}
