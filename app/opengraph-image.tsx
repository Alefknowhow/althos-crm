import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/constants/brand'

export const runtime = 'edge'
export const alt = `${BRAND.name} — ${BRAND.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Imagem padrão de Open Graph/Twitter Card — aplicada a toda página pública
 * que não define a sua própria (convenção de arquivo do Next.js, cascateia
 * para as rotas filhas de app/(public)/*). Sem isso, um link da Althos
 * colado no WhatsApp/LinkedIn aparecia sem nenhum card visual.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '80px 90px',
          background: '#141414',
          backgroundImage: 'radial-gradient(circle at 82% 22%, rgba(69,137,255,0.35), transparent 55%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 44,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#0f62fe',
              color: '#fff',
              fontSize: 30,
              fontWeight: 700,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            A
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: '#f4f4f4' }}>
            {BRAND.name}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 60,
            fontWeight: 700,
            lineHeight: 1.15,
            color: '#f4f4f4',
            maxWidth: 900,
          }}
        >
          Mais vendas fechadas. Nenhum lead esquecido.
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 28,
            color: '#a8a8a8',
            maxWidth: 820,
          }}
        >
          CRM com IA para times que vendem no WhatsApp.
        </div>
      </div>
    ),
    { ...size },
  )
}
