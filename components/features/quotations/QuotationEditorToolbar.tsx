'use client'

import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Loader2, Copy, ExternalLink,
  Link2, Sparkles, FileText,
} from 'lucide-react'
import { GroupNavMobile, type GroupId } from './QuotationEditorFields'

export default function QuotationEditorToolbar({
  orgSlug, quotationId, title, isOffer, saveState, publicUrl, publicToken,
  activeGroup, setActiveGroup, completeness,
  onOpenExtract, onGenerateLink, onConvertToQuotation, saleBusy,
}: {
  orgSlug: string
  quotationId: string
  title: string
  isOffer: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  publicUrl: string | null
  publicToken: string | null
  activeGroup: GroupId
  setActiveGroup: (g: GroupId) => void
  completeness: number
  onOpenExtract: () => void
  onGenerateLink: (rotate: boolean) => void
  onConvertToQuotation: () => void
  saleBusy: boolean
}) {
  return (
    <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 bg-background/95 backdrop-blur border-b">
      <div className="px-3 sm:px-5 py-2.5 flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/${orgSlug}/cotacoes`}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
        </Button>
        <span className="text-sm font-semibold truncate flex-1 min-w-[120px]">{title || 'Nova cotação'}</span>
        <Button type="button" variant="outline" size="sm" onClick={onOpenExtract}>
          <Sparkles className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Autopreencher com IA</span>
        </Button>
        {!isOffer && (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={`/app/${orgSlug}/cotacoes/${quotationId}/pdf`} target="_blank" rel="noopener noreferrer">
              <FileText className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Gerar PDF</span>
            </a>
          </Button>
        )}
        {saveState === 'error' && (
          <span className="text-[11px] text-destructive">Erro ao salvar</span>
        )}
        {publicUrl && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={async () => {
              try { await navigator.clipboard.writeText(window.location.origin + publicUrl); toast.success('Link copiado') } catch { toast.error('Não foi possível copiar') }
            }}><Copy className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Copiar link</span></Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Abrir</span></a>
            </Button>
          </>
        )}
        {!publicToken && (
          <Button type="button" size="sm" onClick={() => onGenerateLink(false)}>
            <Link2 className="w-3.5 h-3.5 mr-1" /> Gerar link
          </Button>
        )}
        {isOffer && (
          <Button type="button" size="sm" variant="secondary" onClick={onConvertToQuotation} disabled={saleBusy}>
            {saleBusy ? <Loader2 className="w-3.5 h-3.5 sm:mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 sm:mr-1" />}
            <span className="hidden sm:inline">Converter em cotação</span>
          </Button>
        )}
        {/* Enviar ao cliente / Adicionar a ofertas / Gerar reserva ficam na
            prévia da lista (ProposalsList.tsx → ProposalDetail), ao lado de
            "Duplicar" — menos botões aqui, o essencial pra quem tá editando. */}
      </div>
      <GroupNavMobile active={activeGroup} onChange={setActiveGroup} completeness={completeness} />
    </div>
  )
}
