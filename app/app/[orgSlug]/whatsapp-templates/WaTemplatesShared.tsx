'use client'

/**
 * Shared formatting helpers for WaTemplatesClient's dialogs. Split out
 * of WaTemplatesClient.tsx.
 */

import { ImageIcon, FileText, Video } from 'lucide-react'

export function categoryColor(c: string) {
  if (c === 'MARKETING')      return 'bg-pink-100 text-pink-700'
  if (c === 'AUTHENTICATION') return 'bg-blue-100 text-blue-700'
  return 'bg-violet-100 text-violet-700'
}
export function statusColor(s: string) {
  if (s === 'approved') return 'bg-emerald-100 text-emerald-700'
  if (s === 'rejected') return 'bg-red-100 text-red-700'
  if (s === 'pending')  return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}
export function statusLabel(s: string) {
  if (s === 'approved') return 'Aprovado'
  if (s === 'rejected') return 'Rejeitado'
  if (s === 'pending')  return 'Pendente'
  return 'Local'
}
export function headerIcon(t: string) {
  if (t === 'image')    return <ImageIcon className="w-3.5 h-3.5" />
  if (t === 'video')    return <Video className="w-3.5 h-3.5" />
  if (t === 'document') return <FileText className="w-3.5 h-3.5" />
  return null
}

/** Counts {{n}} placeholders in the body */
export function countVars(body: string): number {
  const matches = body.match(/\{\{\d+\}\}/g)
  return matches ? new Set(matches.map(m => m.replace(/\D/g, ''))).size : 0
}

/** Highlights {{n}} in body preview */
export function BodyPreview({ text }: { text: string }) {
  const parts = text.split(/(\{\{\d+\}\})/)
  return (
    <span>
      {parts.map((p, i) =>
        /^\{\{\d+\}\}$/.test(p)
          ? <span key={i} className="inline-block rounded bg-emerald-100 text-emerald-700 text-[11px] font-mono px-1 mx-0.5">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </span>
  )
}
