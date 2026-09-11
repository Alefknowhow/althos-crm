'use client'

import { useEffect, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AnimatedMapBlock from './AnimatedMapBlock'
import { hasAnimatableRoute } from '@/lib/geo/animatedMapRoute'
import { PIN_COLORS } from './PublicQuotationHelpers'
import type { PublicQuotation, QuotationPin } from './PublicQuotationTypes'

/** Usado pelo pai (PublicQuotationView) pra decidir se esconde o bloco
 *  "Mapa da viagem" de baixo (o de pins) — quando a abertura animada está
 *  ativa, ele passa a viver aqui, no mesmo lugar, em vez de duplicado. */
export function shouldShowMapOpening(data: PublicQuotation): boolean {
  return !!data.animated_map_enabled && hasAnimatableRoute(data.animated_map_route ?? null)
}

/**
 * Abertura animada do mapa (avião + rastro + bandeiras) que, ao terminar,
 * dá lugar ao mapa "de verdade" (Google Maps com os pins da cotação) no
 * mesmo espaço — mesma ideia de intro cinematográfica que termina no
 * conteúdo real. Sem pins cadastrados, a animação simplesmente fica parada
 * no frame final (não há mapa real pra crossfade).
 */
export default function PublicQuotationAnimatedMap({
  data, pins, pinTypes, mapRef, initMap,
}: {
  data: PublicQuotation
  pins: QuotationPin[]
  pinTypes: string[]
  mapRef: RefObject<HTMLDivElement>
  initMap: () => void
}) {
  const [finished, setFinished] = useState(false)
  const showRealMap = finished && pins.length > 0

  useEffect(() => {
    if (showRealMap) initMap()
  }, [showRealMap, initMap])

  if (!shouldShowMapOpening(data)) return null

  return (
    <section className="reveal mt-[22px]">
      <AnimatePresence mode="wait">
        {showRealMap ? (
          <motion.div key="real-map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
            className="rounded-lg border overflow-hidden">
            <div ref={mapRef} className="alq-map" />
            <div className="map-legend p-2">
              {pinTypes.includes('lodging') && <span><i className="dot" style={{ background: PIN_COLORS.lodging }} /> Hospedagem</span>}
              {(pinTypes.includes('attraction') || pinTypes.includes('custom')) && <span><i className="dot" style={{ background: PIN_COLORS.attraction }} /> Atrações</span>}
              {pinTypes.includes('airport') && <span><i className="dot" style={{ background: PIN_COLORS.airport }} /> Aeroporto</span>}
            </div>
          </motion.div>
        ) : (
          <motion.div key="animation" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <AnimatedMapBlock route={data.animated_map_route ?? null} onFinished={() => setFinished(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
