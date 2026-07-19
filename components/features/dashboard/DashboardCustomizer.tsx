'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { Settings2, X, Plus, Check, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { saveDashboardLayout } from '@/actions/dashboard-layout'
import { WIDGET_CATALOG, getWidgetMeta, type WidgetSize } from '@/lib/dashboard/widget-catalog'

type Props = {
  orgSlug: string
  widgetKeys: string[]
  renderedByKey: Record<string, ReactNode>
}

function sizeClass(size: WidgetSize) {
  return size === 'full' ? 'lg:col-span-2' : 'lg:col-span-1'
}

function SortableWidget({
  id, editing, onRemove, children,
}: {
  id: string
  editing: boolean
  onRemove: () => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: DndCSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  if (!editing) return <div>{children}</div>

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative rounded-none border-2 border-dashed border-primary/40 p-1"
    >
      <div className="absolute -top-3 left-3 z-10 flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex items-center justify-center h-6 w-6 rounded-full bg-background border   text-muted-foreground cursor-grab active:cursor-grabbing"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center h-6 w-6 rounded-full bg-destructive text-destructive-foreground  "
          aria-label="Remover widget"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="pointer-events-none opacity-90">{children}</div>
    </div>
  )
}

export default function DashboardCustomizer({ orgSlug, widgetKeys, renderedByKey }: Props) {
  const [editing, setEditing] = useState(false)
  const [keys, setKeys] = useState(widgetKeys)
  const [showAdd, setShowAdd] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const hiddenWidgets = WIDGET_CATALOG.filter(w => !keys.includes(w.key))

  function persist(next: string[]) {
    setKeys(next)
    startTransition(async () => {
      const res = await saveDashboardLayout(orgSlug, next)
      if (!res.ok) toast.error('Não foi possível salvar', { description: res.error })
      else router.refresh()
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldI = keys.indexOf(String(active.id))
    const newI = keys.indexOf(String(over.id))
    if (oldI === -1 || newI === -1) return
    persist(arrayMove(keys, oldI, newI))
  }

  function handleRemove(key: string) {
    persist(keys.filter(k => k !== key))
  }

  function handleAdd(key: string) {
    persist([...keys, key])
    setShowAdd(false)
  }

  return (
    <>
      <div className="flex justify-end -mb-2">
        <Button
          variant={editing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditing(v => !v)}
        >
          {editing ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Settings2 className="w-3.5 h-3.5 mr-1.5" />}
          {editing ? 'Concluir' : 'Personalizar'}
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {keys.map(key => {
              const def = getWidgetMeta(key)
              if (!def || !renderedByKey[key]) return null
              return (
                <div key={key} className={sizeClass(def.size)}>
                  <SortableWidget id={key} editing={editing} onRemove={() => handleRemove(key)}>
                    {renderedByKey[key]}
                  </SortableWidget>
                </div>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      {editing && (
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setShowAdd(v => !v)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar widget
          </Button>
          {showAdd && (
            <div className="absolute z-20 mt-2 w-72 rounded-lg border bg-popover   p-1.5 max-h-72 overflow-y-auto">
              {hiddenWidgets.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Todos os widgets já estão no painel.</p>
              ) : (
                hiddenWidgets.map(w => (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => handleAdd(w.key)}
                    className="w-full text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-muted"
                  >
                    {w.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
