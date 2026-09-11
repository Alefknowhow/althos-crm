import AnimatedMapBlock from './AnimatedMapBlock'
import { hasAnimatableRoute } from '@/lib/geo/animatedMapRoute'
import type { PublicQuotation } from './PublicQuotationTypes'

/** Decide se o bloco de mapa animado aparece no link público — delega o
 *  render em si (client-only) pro AnimatedMapBlock. Bloco independente do
 *  mapa de pins (que continua no seu lugar de sempre, mais abaixo). */
export default function PublicQuotationAnimatedMap({ data }: { data: PublicQuotation }) {
  if (!data.animated_map_enabled || !hasAnimatableRoute(data.animated_map_route ?? null)) return null
  return (
    <section className="reveal mt-[22px]">
      <AnimatedMapBlock route={data.animated_map_route ?? null} />
    </section>
  )
}
