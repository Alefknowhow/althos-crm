'use client'

import { useState } from 'react'
import { respondToCreativePublic } from '@/actions/campaign-creatives'

export type PublicCreative = {
  id: string
  title: string
  description: string | null
  media_type: 'image' | 'video' | 'pdf'
  storage_key: string
  status: 'pendente' | 'aprovado' | 'reprovado'
  client_comment: string | null
  org: { name: string | null; logo_url: string | null } | null
}

export default function PublicCreativeApprovalView({ token, creative }: { token: string; creative: PublicCreative }) {
  const [status, setStatus] = useState(creative.status)
  const [comment, setComment] = useState(creative.client_comment || '')
  const [submitting, setSubmitting] = useState<'aprovado' | 'reprovado' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function respond(next: 'aprovado' | 'reprovado') {
    setSubmitting(next)
    setError(null)
    const res = await respondToCreativePublic(token, next, comment || null)
    setSubmitting(null)
    if (!res.ok) { setError(res.error); return }
    setStatus(next)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        {creative.org?.name && (
          <div className="flex items-center gap-2">
            {creative.org.logo_url && (
              <img src={creative.org.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
            )}
            <span className="text-sm text-gray-500">{creative.org.name}</span>
          </div>
        )}

        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="bg-gray-100">
            {creative.media_type === 'image' && (
              <img src={creative.storage_key} alt={creative.title} className="w-full max-h-[480px] object-contain" />
            )}
            {creative.media_type === 'video' && (
              <video src={creative.storage_key} controls className="w-full max-h-[480px]" />
            )}
            {creative.media_type === 'pdf' && (
              <iframe src={creative.storage_key} className="w-full h-[480px]" title={creative.title} />
            )}
          </div>

          <div className="p-5 space-y-4">
            <div>
              <h1 className="text-lg font-bold">{creative.title}</h1>
              {creative.description && <p className="text-sm text-gray-600 mt-1">{creative.description}</p>}
            </div>

            {status !== 'pendente' ? (
              <div className={`rounded-md p-3 text-sm ${status === 'aprovado' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {status === 'aprovado' ? 'Você aprovou este criativo.' : 'Você reprovou este criativo.'}
                {comment && <p className="mt-1 italic">&quot;{comment}&quot;</p>}
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Comentário (opcional)</label>
                  <textarea
                    className="w-full border rounded-md p-2 text-sm"
                    rows={3}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Alguma observação sobre este criativo?"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => respond('aprovado')}
                    disabled={submitting !== null}
                    className="flex-1 bg-green-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {submitting === 'aprovado' ? 'Enviando…' : 'Aprovar'}
                  </button>
                  <button
                    onClick={() => respond('reprovado')}
                    disabled={submitting !== null}
                    className="flex-1 bg-red-600 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {submitting === 'reprovado' ? 'Enviando…' : 'Reprovar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
