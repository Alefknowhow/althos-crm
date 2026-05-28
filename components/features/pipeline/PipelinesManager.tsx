'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Star, Pencil, Trash2, ArrowRight } from 'lucide-react'
import {
  createPipeline,
  renamePipeline,
  setDefaultPipeline,
  deletePipeline,
} from '@/actions/pipeline'

type Pipeline = {
  id: string
  name: string
  is_default: boolean
  stage_count: number
  lead_count: number
}

export default function PipelinesManager({
  orgSlug,
  initial,
}: {
  orgSlug: string
  initial: Pipeline[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await createPipeline(orgSlug, newName)
    if (res.ok) {
      toast.success('Pipeline criado')
      setCreateOpen(false)
      setNewName('')
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  async function handleRename(id: string) {
    const res = await renamePipeline(orgSlug, id, renameValue)
    if (res.ok) {
      toast.success('Renomeado')
      setRenamingId(null)
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  async function handleSetDefault(id: string) {
    const res = await setDefaultPipeline(orgSlug, id)
    if (res.ok) {
      toast.success('Pipeline definido como padrão')
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Excluir o pipeline "${name}"? Esta ação é irreversível.`)) return
    const res = await deletePipeline(orgSlug, id)
    if (res.ok) {
      toast.success('Pipeline excluído')
      refresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {initial.length === 0 ? 'Nenhum pipeline criado' : `${initial.length} pipeline(s)`}
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1" /> Novo Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Pipeline</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do pipeline</Label>
                <Input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Clínica Bem-Estar / Concessionária X / Produto Y"
                />
                <p className="text-xs text-muted-foreground">
                  Vai começar com 3 estágios padrão (Novo, Em contato, Ganho). Você ajusta depois.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending || !newName.trim()}>
                  {isPending ? 'Criando...' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {initial.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Você ainda não tem pipelines. Clique em "Novo Pipeline" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {initial.map(p => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="space-y-1 flex-1">
                  {renamingId === p.id ? (
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        className="h-8"
                      />
                      <Button size="sm" onClick={() => handleRename(p.id)} disabled={isPending}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      {p.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1" /> Padrão
                        </Badge>
                      )}
                    </div>
                  )}
                  <CardDescription>
                    {p.stage_count} estágio(s) · {p.lead_count} lead(s)
                  </CardDescription>
                </div>

                {renamingId !== p.id && (
                  <div className="flex items-center gap-1">
                    <Link href={`/app/${orgSlug}/pipeline?pipeline_id=${p.id}`}>
                      <Button variant="ghost" size="sm" title="Abrir kanban">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Renomear"
                      onClick={() => {
                        setRenamingId(p.id)
                        setRenameValue(p.name)
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {!p.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Tornar padrão"
                        onClick={() => handleSetDefault(p.id)}
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    {!p.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Excluir"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(p.id, p.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href={`/app/${orgSlug}/pipeline?pipeline_id=${p.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  Configurar estágios →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
