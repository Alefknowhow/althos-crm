'use client'

import { useMemo, useState } from 'react'
import { Search, LayoutGrid, List as ListIcon, Plus, ChevronDown, Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import EmptyState from '@/components/ui/empty-state'
import { FolderKanban } from 'lucide-react'
import ProjectsBoard from './ProjectsBoard'
import ProjectsList from './ProjectsList'
import ProjectDialog from './ProjectDialog'
import ProjectColumnsManager from './ProjectColumnsManager'
import ProjectTemplatesManager from './ProjectTemplatesManager'
import ApplyTemplateDialog from './ApplyTemplateDialog'
import { PROJECT_HEALTH_LABEL, type ProjectHealth } from '@/lib/validators/project'
import type { ProjectRow } from '@/actions/projects'
import type { ProjectColumn } from '@/actions/project-columns'
import type { ProjectTemplateRow } from '@/actions/project-templates'

type ClientOption = { id: string; name: string }
type MemberOption = { user_id: string; name: string }

interface Props {
  orgSlug: string
  projects: ProjectRow[]
  columns: ProjectColumn[]
  templates: ProjectTemplateRow[]
  clients: ClientOption[]
  members: MemberOption[]
  /** Quando fixo num cliente (aba Projetos dentro do Cliente), some com o
   *  filtro de cliente e o toggle vira menos necessário, mas mantemos por
   *  consistência — a lista já some pela prop `projects` filtrada. */
  hideClientFilter?: boolean
}

export default function ProjectsView({ orgSlug, projects, columns, templates, clients, members, hideClientFilter }: Props) {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false)
  const [templatesManagerOpen, setTemplatesManagerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [healthFilter, setHealthFilter] = useState<'all' | ProjectHealth>('all')
  const [tagFilter, setTagFilter] = useState('all')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) for (const t of p.tags || []) set.add(t)
    return Array.from(set).sort()
  }, [projects])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter(p => {
      if (q && !`${p.name} ${p.client?.name || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q)) return false
      if (clientFilter !== 'all' && p.client_id !== clientFilter) return false
      if (ownerFilter !== 'all' && p.owner_id !== ownerFilter) return false
      if (healthFilter !== 'all' && p.health !== healthFilter) return false
      if (tagFilter !== 'all' && !(p.tags || []).includes(tagFilter)) return false
      return true
    })
  }, [projects, search, clientFilter, ownerFilter, healthFilter, tagFilter])

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <ProjectDialog orgSlug={orgSlug} clients={clients} members={members} defaultClientId={hideClientFilter ? clients[0]?.id : undefined} />
        </div>
        <EmptyState
          icon={FolderKanban}
          title="Nenhum projeto ainda"
          description="Crie um projeto para organizar tarefas por iniciativa (ex.: uma campanha, implantação ou entrega interna) — com ou sem cliente vinculado."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar projeto ou cliente..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {!hideClientFilter && (
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={healthFilter} onValueChange={v => setHealthFilter(v as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Saúde" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as saúdes</SelectItem>
              {Object.entries(PROJECT_HEALTH_LABEL).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tags</SelectItem>
                {allTags.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="icon" className="rounded-none h-8 w-8" onClick={() => setView('board')}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" className="rounded-none h-8 w-8" onClick={() => setView('list')}>
              <ListIcon className="w-4 h-4" />
            </Button>
          </div>
          <ProjectColumnsManager orgSlug={orgSlug} columns={columns} />
          <ProjectDialog orgSlug={orgSlug} clients={clients} members={members} defaultClientId={hideClientFilter ? clients[0]?.id : undefined} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Mais opções de criação">
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setApplyTemplateOpen(true)} disabled={templates.length === 0}>
                <Plus className="w-3.5 h-3.5 mr-2" /> A partir de um template
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTemplatesManagerOpen(true)}>
                <Layers className="w-3.5 h-3.5 mr-2" /> Gerenciar templates
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {view === 'board' ? (
        <ProjectsBoard orgSlug={orgSlug} projects={filtered} columns={columns} />
      ) : (
        <ProjectsList orgSlug={orgSlug} projects={filtered} />
      )}

      <ApplyTemplateDialog
        orgSlug={orgSlug} templates={templates} clients={clients} members={members}
        defaultClientId={hideClientFilter ? clients[0]?.id : undefined}
        open={applyTemplateOpen} onOpenChange={setApplyTemplateOpen}
      />
      <ProjectTemplatesManager orgSlug={orgSlug} templates={templates} open={templatesManagerOpen} onOpenChange={setTemplatesManagerOpen} />
    </div>
  )
}
