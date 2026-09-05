'use client'

/**
 * Full-message preview dialog (header, body, variables, footer) for
 * WaTemplatesClient. Split out of WaTemplatesClient.tsx.
 */

import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ExternalLink } from 'lucide-react'
import type { WaTemplate } from '@/actions/whatsapp-templates'
import { categoryColor, statusColor, statusLabel, headerIcon, BodyPreview } from './WaTemplatesShared'

export function PreviewDialog({ template, onClose }: { template: WaTemplate | null; onClose: () => void }) {
  return (
    <Dialog open={!!template} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {template && (
          <>
            <DialogHeader>
              <DialogTitle>{template.display_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{template.name}</span>
                <Badge variant="outline" className={`text-[10px] font-semibold ${categoryColor(template.category)}`}>{template.category}</Badge>
                <Badge variant="outline" className={`text-[10px] font-semibold ${statusColor(template.status)}`}>{statusLabel(template.status)}</Badge>
                <span>· {template.language}</span>
              </div>

              <div className="rounded-md border border-emerald-100 bg-[#ECF8F0] p-4">
                <div className="bg-white rounded-md max-w-xs p-3 space-y-1.5">
                  {template.header_type === 'image' && template.header_media_url && (
                    <img src={template.header_media_url} alt="header" className="rounded w-full h-28 object-cover" />
                  )}
                  {['video', 'document'].includes(template.header_type) && template.header_media_url && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {headerIcon(template.header_type)}
                      <a href={template.header_media_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        Ver arquivo do cabeçalho <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {template.header_type === 'text' && template.header_text && (
                    <p className="text-sm font-bold text-foreground">{template.header_text}</p>
                  )}
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    <BodyPreview text={template.body_text} />
                  </p>
                  {template.footer_text && (
                    <p className="text-[11px] text-muted-foreground">{template.footer_text}</p>
                  )}
                </div>
              </div>

              {template.variable_names && template.variable_names.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variáveis</Label>
                  <div className="space-y-1">
                    {template.variable_names.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-mono rounded bg-muted px-1.5 py-0.5 text-muted-foreground shrink-0">{`{{${i + 1}}}`}</span>
                        <span>{v || <span className="text-muted-foreground italic">sem nome</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {template.status === 'rejected' && template.rejected_reason && (
                <p className="text-xs text-red-600">
                  <strong>Motivo da rejeição:</strong> {template.rejected_reason}
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
