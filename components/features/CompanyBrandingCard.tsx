'use client'

/**
 * Logo upload + meta mensal de receita — o que sobrou de "Aparência" depois
 * que a cor customizável por organização saiu (Etapa 2 do redesign Carbon:
 * só um azul de destaque no app inteiro, sem seletor por cliente). O logo
 * ainda é branding real: aparece nas propostas/cotações públicas.
 */

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { updateOrgAppearance, setMonthlyRevenueGoal } from '@/actions/organization'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Upload, Loader2 } from 'lucide-react'

export default function CompanyBrandingCard({
  orgSlug,
  orgId,
  initialLogoUrl,
  initialGoalCents,
}: {
  orgSlug: string
  orgId: string
  initialLogoUrl: string | null
  initialGoalCents: number | null
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [uploading, setUploading] = useState(false)

  const [goalInput, setGoalInput] = useState(
    initialGoalCents != null ? (initialGoalCents / 100).toFixed(2) : '',
  )
  const [isPending, startTransition] = useTransition()

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
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${orgId}/logo.${ext}`

      const { error: upErr } = await supabase.storage
        .from('org-logos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('org-logos').getPublicUrl(path)
      const bustedUrl = `${publicUrl}?t=${Date.now()}`

      const res = await updateOrgAppearance(orgSlug, { logo_url: bustedUrl })
      if (!res.ok) throw new Error((res as any).error || 'Não foi possível salvar a logo.')

      setLogoUrl(bustedUrl)
      toast.success('Logo atualizada!')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao fazer upload.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleGoalBlur() {
    const normalized = goalInput.replace(',', '.').trim()
    const reais = normalized === '' ? null : Number(normalized)
    const cents = reais == null || Number.isNaN(reais) ? null : Math.round(reais * 100)

    startTransition(async () => {
      const res = await setMonthlyRevenueGoal(orgSlug, cents)
      if (!res.ok) toast.error('Erro ao salvar meta.')
      else toast.success(cents == null ? 'Meta removida.' : 'Meta mensal salva!')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marca e metas</CardTitle>
        <CardDescription>Logo usada nas propostas e a meta mensal de receita da Inicial.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        <div className="space-y-3">
          <Label>Logo da organização</Label>
          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 border border-border flex items-center justify-center bg-muted overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => fileInputRef.current?.click()}
              title="Clique para trocar a logo"
            >
              {logoUrl ? (
                <Image src={logoUrl} alt="Logo" width={80} height={80} className="object-contain w-full h-full" unoptimized />
              ) : (
                <span className="text-xs text-muted-foreground text-center px-1">Sem logo</span>
              )}
            </div>
            <div className="space-y-1">
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</>
                ) : (
                  <><Upload className="w-3.5 h-3.5 mr-1.5" /> Fazer upload</>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP ou SVG · máx. 2 MB</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="space-y-2 max-w-xs">
          <Label htmlFor="monthly-goal">Meta mensal de receita</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Usada como linha de referência no gráfico "Receita vs. meta" da Inicial.
          </p>
          <Input
            id="monthly-goal"
            inputMode="decimal"
            placeholder="Ex: 50000.00"
            value={goalInput}
            onChange={e => setGoalInput(e.target.value)}
            onBlur={handleGoalBlur}
            disabled={isPending}
          />
        </div>
      </CardContent>
    </Card>
  )
}
