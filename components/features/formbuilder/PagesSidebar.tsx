'use client'

import { Plus, Sparkles, PartyPopper } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getFieldTypeDef } from './FieldTypeMeta'
import FieldTypePicker from './FieldTypePicker'
import type { ActivePageId } from './types'

function SortablePill({ id, active, onClick, children }: { id: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer border transition-colors group ${
        active ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'
      }`}
    >
      <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 text-xs px-0.5" onClick={e => e.stopPropagation()}>
        ⋮⋮
      </span>
      {children}
    </div>
  )
}

interface Props {
  fields: any[]
  welcomeEnabled: boolean
  activePageId: ActivePageId
  onSelect: (id: ActivePageId) => void
  onReorder: (fromId: string, toId: string) => void
  onAddField: (type: string) => void
  onEnableWelcome: () => void
}

export default function PagesSidebar({ fields, welcomeEnabled, activePageId, onSelect, onReorder, onAddField, onEnableWelcome }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: any) {
    const { active, over } = event
    if (active.id !== over?.id && over) onReorder(active.id, over.id)
  }

  return (
    <div className="w-60 shrink-0 border-r bg-muted/10 flex flex-col overflow-y-auto">
      <div className="p-3">
        <p className="text-xs font-semibold text-muted-foreground px-1 mb-1.5">Páginas</p>

        {welcomeEnabled ? (
          <SortablePill id="welcome" active={activePageId === 'welcome'} onClick={() => onSelect('welcome')}>
            <span className="flex items-center justify-center w-6 h-6 rounded bg-amber-100 text-amber-700 shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="text-sm truncate">Boas-vindas</span>
          </SortablePill>
        ) : (
          <button
            type="button"
            onClick={onEnableWelcome}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Tela de Boas-Vindas
          </button>
        )}
      </div>

      <div className="flex-1 px-3 pb-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {fields.map((f, i) => {
                const def = getFieldTypeDef(f.type)
                const Icon = def.icon
                return (
                  <SortablePill key={f.id} id={f.id} active={activePageId === f.id} onClick={() => onSelect(f.id)}>
                    <span className="w-4 text-[10px] font-mono text-muted-foreground shrink-0 text-center">{i + 1}</span>
                    <span className={`flex items-center justify-center w-6 h-6 rounded ${def.colorClass} shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm truncate flex-1">{f.label || def.label}</span>
                  </SortablePill>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        <FieldTypePicker
          onSelect={onAddField}
          trigger={
            <button
              type="button"
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar pergunta
            </button>
          }
        />
      </div>

      <div className="p-3 border-t">
        <p className="text-xs font-semibold text-muted-foreground px-1 mb-1.5">Finalização</p>
        <SortablePillStatic active={activePageId === 'ending'} onClick={() => onSelect('ending')} />
      </div>
    </div>
  )
}

/** Item fixo (não arrastável, sempre existe) da tela de agradecimento. */
function SortablePillStatic({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer border transition-colors ${
        active ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'
      }`}
    >
      <span className="flex items-center justify-center w-6 h-6 rounded bg-emerald-100 text-emerald-700 shrink-0">
        <PartyPopper className="w-3.5 h-3.5" />
      </span>
      <span className="text-sm truncate">Agradecimento</span>
    </div>
  )
}
