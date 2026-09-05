'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Bookmark, Save, X } from 'lucide-react'
import type { SavedFilter } from '@/actions/saved_filters'

/* -------- Saved filter menu -------- */

export default function SavedFilterMenu({
  filters,
  onApply,
  onSave,
  onDelete,
  hasActiveFilters,
}: {
  filters: SavedFilter[]
  onApply: (f: SavedFilter) => void
  onSave: (name: string, isShared: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  hasActiveFilters: boolean
}) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [saving, setSaving] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Bookmark className="w-4 h-4 mr-2" /> Filtros salvos
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <DropdownMenuLabel>Aplicar</DropdownMenuLabel>
          {filters.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum filtro salvo ainda.</div>
          ) : (
            filters.map(f => (
              <DropdownMenuItem
                key={f.id}
                className="flex justify-between items-center"
                onClick={() => onApply(f)}
              >
                <span className="truncate">
                  {f.name} {f.is_shared && <span className="text-[10px] text-muted-foreground">· compartilhado</span>}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onDelete(f.id)
                  }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!hasActiveFilters}
            onClick={() => setSaveOpen(true)}
          >
            <Save className="w-4 h-4 mr-2" /> Salvar filtro atual
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar filtro atual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Quentes do Instagram"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={shared} onCheckedChange={c => setShared(!!c)} />
              Compartilhar com a equipe
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={saving || !name.trim()}
              onClick={async () => {
                setSaving(true)
                await onSave(name, shared)
                setSaving(false)
                setSaveOpen(false)
                setName('')
                setShared(false)
              }}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
