'use client'

/**
 * Grupo "Fechamento" do editor de cotação — mensagem de encerramento,
 * assinatura destacada e rodapé/identidade da agência.
 *
 * Extraído de QuotationEditor.tsx (pura movimentação de JSX, sem mudança de
 * comportamento) — recebe o estado relevante e os setters via props.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, MessageCircle, UserRound, Building2, Save, Trash2 } from 'lucide-react'

import { getUserProfile } from '@/actions/profile'
import type { FooterProfileRow } from '@/actions/quotations'
import ItineraryEditor from '@/components/features/proposals/ItineraryEditor'
import {
  SignaturePhotoUpload,
  F, EditBlock, type GroupId, GroupSection,
} from './QuotationEditorFields'
import type { QuotationTopState } from './QuotationEditorTypes'

export default function QuotationEditorFechamentoGroup({
  orgSlug, activeGroup, q, setQ, whatsappNumber,
  footerProfiles, footerProfileBusy, applyFooterProfile, saveFooterProfile, removeFooterProfile,
}: {
  orgSlug: string
  activeGroup: GroupId
  q: QuotationTopState
  setQ: React.Dispatch<React.SetStateAction<QuotationTopState>>
  whatsappNumber?: string | null
  footerProfiles: FooterProfileRow[]
  footerProfileBusy: boolean
  applyFooterProfile: (p: FooterProfileRow) => void
  saveFooterProfile: () => void
  removeFooterProfile: (id: string) => void
}) {
  return (
    <GroupSection id="fechamento" active={activeGroup}>
      {/* FECHAMENTO */}
      <EditBlock id="blk-fechamento" icon={MessageCircle} title="Fechamento">
        <ItineraryEditor orgSlug={orgSlug} value={q.closing_html} onChange={html => setQ(s => ({ ...s, closing_html: html }))} />
        <p className="text-[11px] text-muted-foreground">
          Os botões de WhatsApp usam o número configurado da agência
          {whatsappNumber ? ` (${whatsappNumber})` : ' — nenhum configurado'}.
          {' '}Rodapé e white-label vêm das{' '}
          <Link href={`/app/${orgSlug}/configuracoes/organizacoes`} className="underline">configurações da agência</Link>.
        </p>
      </EditBlock>

      {/* ASSINATURA — bloco destacado abaixo do fechamento, no link público */}
      <EditBlock id="blk-assinatura" icon={UserRound} title="Assinatura"
        action={
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch checked={q.signature_enabled} onCheckedChange={async v => {
              setQ(s => ({ ...s, signature_enabled: v }))
              if (v && !q.signature_name && !q.signature_photo_url) {
                const profile = await getUserProfile(orgSlug)
                if (profile) setQ(s => ({
                  ...s,
                  signature_name: s.signature_name || profile.name,
                  signature_photo_url: s.signature_photo_url || profile.avatar_url,
                }))
              }
            }} />
            {q.signature_enabled ? 'Ativada' : 'Desativada'}
          </label>
        }>
        {q.signature_enabled && (
          <>
            <p className="text-[11px] text-muted-foreground">
              Aparece destacada logo abaixo da mensagem de encerramento, no link público.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <F label="Nome"><Input value={q.signature_name} onChange={e => setQ(s => ({ ...s, signature_name: e.target.value }))} placeholder="Ex.: Ana Souza" /></F>
              <F label="Foto"><SignaturePhotoUpload orgSlug={orgSlug} url={q.signature_photo_url} onChange={u => setQ(s => ({ ...s, signature_photo_url: u }))} /></F>
            </div>
            <F label="Mensagem"><Textarea rows={2} value={q.signature_message} onChange={e => setQ(s => ({ ...s, signature_message: e.target.value }))} placeholder="Ex.: Qualquer dúvida, estou à disposição! 😊" /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Cor de fundo">
                <div className="flex items-center gap-2">
                  <input type="color" value={q.signature_bg_color} onChange={e => setQ(s => ({ ...s, signature_bg_color: e.target.value }))}
                    className="w-9 h-9 rounded border cursor-pointer shrink-0" />
                  <Input value={q.signature_bg_color} onChange={e => setQ(s => ({ ...s, signature_bg_color: e.target.value }))} />
                </div>
              </F>
              <F label="Cor da letra">
                <div className="flex items-center gap-2">
                  <input type="color" value={q.signature_text_color} onChange={e => setQ(s => ({ ...s, signature_text_color: e.target.value }))}
                    className="w-9 h-9 rounded border cursor-pointer shrink-0" />
                  <Input value={q.signature_text_color} onChange={e => setQ(s => ({ ...s, signature_text_color: e.target.value }))} />
                </div>
              </F>
            </div>
            <div className="rounded-lg p-4 flex items-center gap-3" style={{ background: q.signature_bg_color, color: q.signature_text_color }}>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 shrink-0 flex items-center justify-center">
                {q.signature_photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={q.signature_photo_url} alt="" className="w-full h-full object-cover" />
                  : <UserRound className="w-5 h-5 opacity-70" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{q.signature_name || 'Seu nome'}</div>
                <div className="text-xs opacity-90 truncate">{q.signature_message || 'Sua mensagem aparece aqui'}</div>
              </div>
            </div>
          </>
        )}
      </EditBlock>

      {/* RODAPÉ / IDENTIDADE DA AGÊNCIA — por padrão usa os dados da
          organização; quando ativado, usa dados só desta cotação. */}
      <EditBlock id="blk-rodape" icon={Building2} title="Rodapé e informações da agência"
        action={
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch checked={q.footer_override} onCheckedChange={v => setQ(s => ({ ...s, footer_override: v }))} />
            {q.footer_override ? 'Personalizado' : 'Padrão da agência'}
          </label>
        }>
        {!q.footer_override ? (
          <p className="text-[11px] text-muted-foreground">
            Usa logo, nome, endereço, CNPJ, CADASTUR, Instagram, site, WhatsApp, telefone e e-mail das{' '}
            <Link href={`/app/${orgSlug}/configuracoes/organizacoes`} className="underline">configurações da agência</Link>.
            Ative para usar outras informações só nesta cotação.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">Vale só para esta cotação — não altera as configurações da agência.</p>
            <div className="flex items-end gap-2">
              <F label="Usar marca salva">
                <Select value="" onValueChange={v => { const p = footerProfiles.find(x => x.id === v); if (p) applyFooterProfile(p) }}>
                  <SelectTrigger className="w-56"><SelectValue placeholder={footerProfiles.length ? 'Selecionar…' : 'Nenhuma marca salva ainda'} /></SelectTrigger>
                  <SelectContent>
                    {footerProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <Button type="button" size="sm" variant="outline" onClick={saveFooterProfile} disabled={footerProfileBusy}>
                {footerProfileBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Salvar dados
              </Button>
            </div>
            {footerProfiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {footerProfiles.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-xs">
                    {p.name}
                    <button type="button" className="text-muted-foreground hover:text-destructive" aria-label={`Remover marca ${p.name}`}
                      onClick={() => removeFooterProfile(p.id)}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <F label="Nome/razão social"><Input value={q.footer_legal_name} onChange={e => setQ(s => ({ ...s, footer_legal_name: e.target.value }))} /></F>
              <F label="Logo"><SignaturePhotoUpload orgSlug={orgSlug} url={q.footer_logo_url} onChange={u => setQ(s => ({ ...s, footer_logo_url: u }))} /></F>
            </div>
            <F label="Endereço"><Input value={q.footer_address} onChange={e => setQ(s => ({ ...s, footer_address: e.target.value }))} placeholder="Ex.: Florianópolis / SC" /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="CNPJ"><Input value={q.footer_cnpj} onChange={e => setQ(s => ({ ...s, footer_cnpj: e.target.value }))} /></F>
              <F label="CADASTUR"><Input value={q.footer_cadastur} onChange={e => setQ(s => ({ ...s, footer_cadastur: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Instagram"><Input value={q.footer_instagram_url} onChange={e => setQ(s => ({ ...s, footer_instagram_url: e.target.value }))} placeholder="https://instagram.com/..." /></F>
              <F label="Site"><Input value={q.footer_site_url} onChange={e => setQ(s => ({ ...s, footer_site_url: e.target.value }))} placeholder="https://..." /></F>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <F label="WhatsApp" hint="usado nos botões de contato"><Input value={q.footer_whatsapp_number} onChange={e => setQ(s => ({ ...s, footer_whatsapp_number: e.target.value }))} placeholder="55DDNNNNNNNNN" /></F>
              <F label="Telefone"><Input value={q.footer_phone} onChange={e => setQ(s => ({ ...s, footer_phone: e.target.value }))} /></F>
              <F label="E-mail"><Input type="email" value={q.footer_email} onChange={e => setQ(s => ({ ...s, footer_email: e.target.value }))} /></F>
            </div>
          </>
        )}
      </EditBlock>
    </GroupSection>
  )
}
