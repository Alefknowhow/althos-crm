'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Plus, Palette, ExternalLink, Settings, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { FORM_BACKGROUND_PRESETS, DEFAULT_FORM_BACKGROUND, type FormBackgroundPreset } from '@/lib/forms/background-presets'
import { FORM_FONT_PRESETS, DEFAULT_FORM_FONT, type FormFontPreset } from '@/lib/forms/font-presets'
import FieldTypePicker from './FieldTypePicker'

interface Props {
  form: any
  setForm: (f: any) => void
  schema: any
  setSchema: (s: any) => void
  saving: boolean
  onSave: () => void
  onAddField: (type: string) => void
  onOpenSettings: () => void
  onOpenUrlEditor: () => void
}

export default function FormToolbar({ form, setForm, schema, setSchema, saving, onSave, onAddField, onOpenSettings, onOpenUrlEditor }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b bg-background shrink-0 flex-wrap">
      <FieldTypePicker
        onSelect={onAddField}
        trigger={
          <Button size="sm" variant="default" className="gap-1.5">
            <Plus className="w-4 h-4" /> Adicionar conteúdo
          </Button>
        }
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Palette className="w-4 h-4" /> Design
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2">
          <Label className="text-xs">Cor de fundo</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FORM_BACKGROUND_PRESETS) as FormBackgroundPreset[]).map(key => {
              const preset = FORM_BACKGROUND_PRESETS[key]
              const active = (schema.style?.backgroundPreset || DEFAULT_FORM_BACKGROUND) === key
              return (
                <button
                  type="button"
                  key={key}
                  title={preset.label}
                  onClick={() => setSchema({ ...schema, style: { ...(schema.style || {}), backgroundPreset: key } })}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${active ? 'border-primary scale-110' : 'border-transparent hover:border-muted-foreground/30'}`}
                  style={{ background: preset.gradient }}
                />
              )
            })}
          </div>

          <Label className="text-xs pt-1 block">Fonte</Label>
          <div className="space-y-0.5">
            {(Object.keys(FORM_FONT_PRESETS) as FormFontPreset[]).map(key => {
              const preset = FORM_FONT_PRESETS[key]
              const active = (schema.style?.fontFamily || DEFAULT_FORM_FONT) === key
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSchema({ ...schema, style: { ...(schema.style || {}), fontFamily: key } })}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors ${active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
                  style={{ fontFamily: preset.stack }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(`/f/${form.slug}/preview`, '_blank')}>
        <ExternalLink className="w-4 h-4" /> Preview
      </Button>

      <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenSettings}>
        <Settings className="w-4 h-4" /> Configurações
      </Button>

      <div className="ml-auto flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Ativo</Label>
          <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer" />
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenUrlEditor}>
          <LinkIcon className="w-4 h-4" /> URL
        </Button>
        <Button size="sm" variant="outline" onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/f/${form.slug}`)
          toast.success('URL copiada!')
        }}>
          Copiar URL
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </div>
  )
}
