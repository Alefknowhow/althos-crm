'use client'

/**
 * AppearanceTab — logo upload + primary color palette.
 *
 * Logo: uploaded client-side to Supabase Storage (bucket: org-logos),
 * URL saved via server action. Max 2 MB, PNG/JPG/WebP/SVG.
 *
 * Color: fixed palette of 12 curated colors. On pick, the hex is saved to DB
 * and also applied immediately to the page via --primary CSS variable so the
 * change is visible without a reload. The layout injects the saved color on
 * every full page load, so it persists across sessions.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { updateOrgAppearance } from '@/actions/organization'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Upload, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRESET_COLORS, type PresetColor } from '@/lib/constants/colors'

/** Apply --primary immediately so the sidebar/buttons update in real time. */
function applyPrimaryColor(hsl: string) {
  document.documentElement.style.setProperty('--primary', hsl)
}

interface AppearanceTabProps {
  orgSlug: string
  orgId: string
  initialLogoUrl: string | null
  initialColor: string | null
}

export default function AppearanceTab({
  orgSlug,
  orgId,
  initialLogoUrl,
  initialColor,
}: AppearanceTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl]       = useState<string | null>(initialLogoUrl)
  const [selectedHex, setSelectedHex] = useState<string | null>(initialColor)
  const [uploading, setUploading]   = useState(false)
  const [isPending, startTransition]  = useTransition()

  // Apply saved color on mount so it survives HMR / client navigation.
  useEffect(() => {
    const preset = PRESET_COLORS.find(c => c.hex === initialColor)
    if (preset) applyPrimaryColor(preset.hsl)
  }, [initialColor])

  // ── Logo upload ────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 2 MB.')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext      = file.name.split('.').pop() ?? 'png'
      const path     = `${orgId}/logo.${ext}`

      const { error: upErr } = await supabase.storage
        .from('org-logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('org-logos')
        .getPublicUrl(path)

      // Bust cache — Supabase CDN caches by path; append timestamp.
      const bustedUrl = `${publicUrl}?t=${Date.now()}`

      startTransition(async () => {
        const res = await updateOrgAppearance(orgSlug, { logo_url: bustedUrl })
        if (!res.ok) throw new Error((res as any).error)
        setLogoUrl(bustedUrl)
        toast.success('Logo atualizada!')
      })
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao fazer upload.')
    } finally {
      setUploading(false)
      // Reset input so the same file can be re-selected if needed.
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Color pick ─────────────────────────────────────────────────────────────
  function handleColorPick(preset: PresetColor) {
    setSelectedHex(preset.hex)
    applyPrimaryColor(preset.hsl)

    startTransition(async () => {
      const res = await updateOrgAppearance(orgSlug, { primary_color: preset.hex })
      if (!res.ok) {
        toast.error('Erro ao salvar cor.')
      } else {
        toast.success(`Cor "${preset.name}" aplicada!`)
      }
    })
  }

  const busy = uploading || isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidade Visual</CardTitle>
        <CardDescription>Personalize o visual do CRM com a sua marca.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* ── Logo ────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>Logo da Organização</Label>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div
              className="w-20 h-20 border rounded-xl flex items-center justify-center bg-muted overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => fileInputRef.current?.click()}
              title="Clique para trocar a logo"
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Logo"
                  width={80}
                  height={80}
                  className="object-contain w-full h-full"
                  unoptimized
                />
              ) : (
                <span className="text-xs text-muted-foreground text-center px-1">Sem logo</span>
              )}
            </div>

            <div className="space-y-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</>
                ) : (
                  <><Upload className="w-3.5 h-3.5 mr-1.5" /> Fazer Upload</>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP ou SVG · máx. 2 MB</p>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* ── Primary color ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>Cor Primária</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Usada em botões, badges e destaques em todo o CRM.
          </p>

          <div className="grid grid-cols-6 gap-2 max-w-xs">
            {PRESET_COLORS.map(preset => {
              const isSelected = selectedHex === preset.hex
              return (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.name}
                  disabled={busy}
                  onClick={() => handleColorPick(preset)}
                  className={cn(
                    'relative w-9 h-9 rounded-full border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    isSelected
                      ? 'border-foreground scale-110 shadow-md'
                      : 'border-transparent hover:scale-110 hover:border-muted-foreground/40',
                  )}
                  style={{ backgroundColor: preset.hex }}
                  aria-pressed={isSelected}
                  aria-label={preset.name}
                >
                  {isSelected && (
                    <Check
                      className="absolute inset-0 m-auto w-4 h-4 drop-shadow"
                      style={{ color: '#fff', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.5))' }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Current color preview */}
          {selectedHex && (
            <div className="flex items-center gap-2 mt-1">
              <div
                className="w-5 h-5 rounded-full border"
                style={{ backgroundColor: selectedHex }}
              />
              <span className="text-xs text-muted-foreground font-mono">{selectedHex}</span>
              <span className="text-xs text-muted-foreground">
                — {PRESET_COLORS.find(c => c.hex === selectedHex)?.name}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        As alterações são salvas automaticamente ao selecionar.
      </CardFooter>
    </Card>
  )
}
