'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateOnboardingStep, createInitialFunnel } from '@/actions/onboarding'
import { toast } from 'sonner'
import { Building2, PieChart, Users, Upload, MessageSquare, CheckCircle2 } from 'lucide-react'

const SECTORS = [
  { id: 'clinica', name: 'Clínica / Saúde', stages: ['Agendamento', 'Consulta', 'Tratamento', 'Pós-atendimento'] },
  { id: 'agencia', name: 'Agência de Marketing', stages: ['Reunião', 'Briefing', 'Proposta', 'Onboarding'] },
  { id: 'educacao', name: 'Educação / Cursos', stages: ['Interesse', 'Matrícula', 'Pagamento', 'Acesso Liberado'] },
  { id: 'outros', name: 'Outros', stages: ['Novo Lead', 'Qualificação', 'Negociação', 'Fechamento'] }
]

export default function OnboardingPage({ params }: { params: { orgSlug: string } }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    sector: '',
    teamSize: '',
    funnelName: '',
    stages: [] as string[]
  })
  
  const router = useRouter()

  const handleNext = async () => {
    setLoading(true)
    try {
      if (step === 1) {
        await updateOnboardingStep(params.orgSlug, 1, { sector: formData.sector, team_size: formData.teamSize })
        setStep(2)
      } else if (step === 2) {
        const selectedSector = SECTORS.find(s => s.id === formData.sector)
        await createInitialFunnel(params.orgSlug, formData.funnelName || 'Vendas ' + (selectedSector?.name || ''), formData.stages.length > 0 ? formData.stages : (selectedSector?.stages || SECTORS[3].stages))
        setStep(3)
      } else if (step === 3) {
        setStep(4)
      } else if (step === 4) {
        await updateOnboardingStep(params.orgSlug, 4)
        toast.success('Onboarding concluído!')
        router.push(`/app/${params.orgSlug}`)
      }
    } catch (error: any) {
      toast.error('Erro ao salvar progresso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="max-w-xl w-full space-y-8">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`h-2 w-12 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted-foreground/20'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Sobre o seu negócio</CardTitle>
              <CardDescription>Conte-nos um pouco sobre a sua empresa para personalizarmos sua experiência.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Qual o seu setor?</Label>
                <div className="grid grid-cols-2 gap-3">
                  {SECTORS.map((s) => (
                    <Button
                      key={s.id}
                      variant={formData.sector === s.id ? 'default' : 'outline'}
                      className="h-20 flex flex-col gap-2"
                      onClick={() => setFormData({ ...formData, sector: s.id })}
                    >
                      <Building2 className="w-5 h-5" />
                      <span className="text-xs">{s.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tamanho da equipe</Label>
                <Select onValueChange={(v) => setFormData({ ...formData, teamSize: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Apenas eu</SelectItem>
                    <SelectItem value="2-5">2 a 5 pessoas</SelectItem>
                    <SelectItem value="6-15">6 a 15 pessoas</SelectItem>
                    <SelectItem value="15+">Mais de 15 pessoas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handleNext} disabled={!formData.sector || !formData.teamSize || loading}>
                Continuar
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Crie seu primeiro funil</CardTitle>
              <CardDescription>O funil ajuda você a visualizar o progresso dos seus leads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Funil</Label>
                <Input 
                  placeholder="Ex: Comercial Principal" 
                  value={formData.funnelName}
                  onChange={(e) => setFormData({ ...formData, funnelName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Etapas recomendadas</Label>
                <div className="space-y-2 border rounded-md p-4 bg-muted/20">
                  {(SECTORS.find(s => s.id === formData.sector)?.stages || SECTORS[3].stages).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {i + 1}
                      </div>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handleNext} disabled={loading}>
                Criar Funil
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Importe seus leads</CardTitle>
              <CardDescription>Já possui uma lista de clientes? Importe agora via CSV.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm text-center text-muted-foreground max-w-[250px]">
                Você pode importar um arquivo .csv com nome, email e telefone.
              </p>
              <Button variant="outline" asChild>
                <a href={`/app/${params.orgSlug}/leads/importar`}>Importar CSV</a>
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full" onClick={handleNext}>Pular por enquanto</Button>
            </CardFooter>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Último passo: WhatsApp</CardTitle>
              <CardDescription>Conecte seu WhatsApp para automatizar suas conversas.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-center text-muted-foreground max-w-[250px]">
                O Althos CRM permite enviar mensagens automáticas e centralizar o chat.
              </p>
              <Button variant="outline" asChild>
                <a href={`/app/${params.orgSlug}/configuracoes/whatsapp`}>Configurar WhatsApp</a>
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full" onClick={handleNext} disabled={loading}>
                Finalizar Onboarding
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}
