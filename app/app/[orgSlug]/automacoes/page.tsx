import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getAutomations, toggleAutomation } from '@/actions/automations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import Link from 'next/link'
import { PlayCircle, PauseCircle, Zap, Activity } from 'lucide-react'
import NewAutomationButton from '@/components/features/NewAutomationButton'

export default async function AutomationsPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const automations = await getAutomations(org.slug)

  async function handleToggle(id: string, current: boolean) {
    'use server'
    const res = await toggleAutomation(params.orgSlug, id, !current)
    if (!res?.ok) {
      console.error('toggleAutomation failed:', res?.error)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automações</h1>
          <p className="text-muted-foreground mt-1">Crie fluxos de trabalho automáticos baseados em gatilhos e ações.</p>
        </div>
        <NewAutomationButton orgSlug={params.orgSlug} />
      </div>

      <div className="grid gap-4">
        {automations.length === 0 ? (
          <div className="text-center p-12 border rounded-xl bg-card text-muted-foreground">
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Nenhuma automação configurada</p>
            <p className="text-sm">Clique em &ldquo;Nova Automação&rdquo; para começar.</p>
          </div>
        ) : (
          automations.map((auto: any) => (
            <div key={auto.id} className="flex items-center justify-between p-6 bg-card border rounded-xl shadow-sm hover:border-primary/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${auto.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {auto.is_active ? <PlayCircle className="w-6 h-6" /> : <PauseCircle className="w-6 h-6" />}
                </div>
                <div>
                  <Link href={`/app/${params.orgSlug}/automacoes/${auto.id}`} className="text-lg font-semibold hover:underline">
                    {auto.name}
                  </Link>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="font-normal">{auto.trigger_type}</Badge>
                    <span>•</span>
                    <span>{auto.steps?.length || 0} passos</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {auto.runsThisMonth} execuções no mês</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{auto.is_active ? 'Ativa' : 'Pausada'}</span>
                  <form action={handleToggle.bind(null, auto.id, auto.is_active)}>
                    <button type="submit" className="flex items-center">
                      <Switch checked={auto.is_active} className="pointer-events-none" />
                    </button>
                  </form>
                </div>
                <Link href={`/app/${params.orgSlug}/automacoes/${auto.id}`}>
                  <Button variant="outline" size="sm">Editar</Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
