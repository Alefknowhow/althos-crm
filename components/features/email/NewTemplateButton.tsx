'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FileText, Plus, Sparkles } from 'lucide-react'
import { createTemplate, createTemplateFromSeed } from '@/actions/emails'
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_SEEDS,
  type TemplateSeed,
} from '@/lib/email/template-seeds'

export default function NewTemplateButton({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [activeCat, setActiveCat] = useState<string>(TEMPLATE_CATEGORIES[0].id)

  function handleBlank() {
    startTransition(async () => {
      const res = await createTemplate(orgSlug, 'Novo Template')
      if ((res as any).ok && (res as any).template) {
        toast.success('Template criado')
        router.push(`/app/${orgSlug}/email-templates/${(res as any).template.id}/edit`)
      } else {
        toast.error((res as any).error || 'Erro ao criar')
      }
    })
  }

  function handleSeed(seed: TemplateSeed) {
    startTransition(async () => {
      const res = await createTemplateFromSeed(orgSlug, seed.key)
      if (res.ok) {
        toast.success(`Template criado a partir de "${seed.name}"`)
        router.push(`/app/${orgSlug}/email-templates/${res.templateId}/edit`)
      } else {
        toast.error(res.error)
      }
    })
  }

  const seedsByCat = TEMPLATE_SEEDS.filter(s => s.category === activeCat)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Novo Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Como deseja começar?</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={handleBlank}
            disabled={isPending}
            className="border rounded-none p-4 hover:bg-muted text-left transition disabled:opacity-50"
          >
            <FileText className="w-6 h-6 text-muted-foreground mb-2" />
            <div className="font-medium text-sm">Em branco</div>
            <div className="text-xs text-muted-foreground">Comece do zero</div>
          </button>
          <div className="border-2 border-primary rounded-none p-4 bg-primary/5">
            <Sparkles className="w-6 h-6 text-primary mb-2" />
            <div className="font-medium text-sm">A partir de modelo pronto</div>
            <div className="text-xs text-muted-foreground">10 templates prontos por categoria</div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap border-b pb-2">
          {TEMPLATE_CATEGORIES.map(c => {
            const count = TEMPLATE_SEEDS.filter(s => s.category === c.id).length
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={`text-xs px-3 py-1.5 rounded-full transition ${
                  activeCat === c.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {c.label} <span className="opacity-60">· {count}</span>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
          {seedsByCat.map(seed => (
            <button
              key={seed.key}
              type="button"
              onClick={() => handleSeed(seed)}
              disabled={isPending}
              className="border rounded-none p-4 hover:border-primary hover:bg-primary/5 text-left transition disabled:opacity-50"
            >
              <div className="font-medium text-sm mb-1">{seed.name}</div>
              <div className="text-xs text-muted-foreground mb-2">{seed.description}</div>
              <div className="text-xs italic text-muted-foreground border-l-2 border-muted pl-2 truncate">
                Assunto: {seed.subject}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
