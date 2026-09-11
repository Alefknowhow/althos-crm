import AnimatedMapBlock from './AnimatedMapBlock'
import type { PublicQuotation } from './PublicQuotationTypes'

/** Decide se o bloco de mapa animado aparece no link público — delega o
 *  render em si (client-only) pro AnimatedMapBlock. */
export default function PublicQuotationAnimatedMap({ data }: { data: PublicQuotation }) {
  if (!data.animated_map_enabled || !data.animated_map_route?.origin?.country) return null
  return (
    <section className="reveal mt-[22px]">
      <AnimatedMapBlock route={data.animated_map_route} />
    </section>
  )
}
