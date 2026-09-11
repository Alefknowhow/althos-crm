'use client'

/**
 * Mapa animado da cotação — avião voando origem → paradas → origem (loop
 * contínuo), deixando um rastro tracejado e pintando cada país visitado com
 * a bandeira dele. Bloco independente (não interage com o mapa de pins).
 *
 * Posição/rotação do avião usam a API nativa `getPointAtLength`/
 * `getTotalLength` do SVG sobre um único `<path>` cobrindo a rota inteira
 * (curvas suaves entre pontos) — evita reimplementar matemática de bezier
 * pra achar posição/ângulo a cada frame. "País visitado" (pra pintar a
 * bandeira) usa uma fração de tempo aproximada por distância em linha reta
 * entre os pontos — só cosmético, não precisa ser exato.
 *
 * A bandeira usa `patternUnits="userSpaceOnUse"` com o bounding box real do
 * país (via `geoPathFn.bounds`) — `objectBoundingBox` + `<image>` é um
 * combo historicamente inconsistente entre navegadores (a imagem some
 * silenciosamente em vários casos), então evitamos essa combinação.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { animate, useMotionValue, useReducedMotion } from 'framer-motion'
import { Plane } from 'lucide-react'
import worldTopo from 'world-atlas/countries-110m.json'
import { resolveRoute, type AnimatedMapRoute } from '@/lib/geo/animatedMapRoute'

export type { AnimatedMapRoute }

// Casts largos (topojson não tem tipos fortes praticados neste repo) — uso
// único e local, não vaza pro resto do app.
const WORLD_FEATURES = (feature(worldTopo as any, (worldTopo as any).objects.countries) as any).features as any[]

const WIDTH = 800
const HEIGHT = 420
const SPEED_PX_PER_SEC = 140
const PAUSE_AT_STOP_MS = 700
const PAUSE_FULL_LAP_MS = 1400
const OCEAN_COLOR = '#0b3d5c'
const LAND_COLOR = '#245a35'

export default function AnimatedMapBlockInner({ route }: { route: AnimatedMapRoute | null }) {
  const reducedMotion = useReducedMotion()
  const pathRef = useRef<SVGPathElement>(null)
  const progress = useMotionValue(0)

  const waypoints = useMemo(() => resolveRoute(route), [route])

  const projection = useMemo(() => geoEqualEarth().fitSize([WIDTH, HEIGHT], { type: 'Sphere' } as any), [])
  const geoPathFn = useMemo(() => geoPath(projection), [projection])

  const projected = useMemo(
    () => waypoints.map(w => projection([w.lng, w.lat])).filter((p): p is [number, number] => !!p),
    [waypoints, projection],
  )

  // Bounding box real (em pixels) de cada país da rota — usado pro
  // <pattern> da bandeira ficar exatamente sobre o contorno do país.
  const flagPatterns = useMemo(() => {
    return waypoints
      .filter((w, i) => waypoints.findIndex(x => x.iso2 === w.iso2) === i)
      .map(w => {
        const f = WORLD_FEATURES.find(feat => feat.properties?.name === w.enName)
        if (!f) return null
        const bounds = geoPathFn.bounds(f)
        return { iso2: w.iso2, x: bounds[0][0], y: bounds[0][1], width: bounds[1][0] - bounds[0][0], height: bounds[1][1] - bounds[0][1] }
      })
      .filter((p): p is { iso2: string; x: number; y: number; width: number; height: number } => !!p)
  }, [waypoints, geoPathFn])

  const routeD = useMemo(() => {
    if (projected.length < 2) return ''
    let d = `M ${projected[0][0]} ${projected[0][1]}`
    for (let i = 0; i < projected.length - 1; i++) {
      const [x1, y1] = projected[i]
      const [x2, y2] = projected[i + 1]
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
      const dx = x2 - x1, dy = y2 - y1
      const dist = Math.hypot(dx, dy) || 1
      const bow = Math.min(50, dist * 0.22)
      const cx = mx - (dy / dist) * bow
      const cy = my + (dx / dist) * bow
      d += ` Q ${cx} ${cy} ${x2} ${y2}`
    }
    return d
  }, [projected])

  const cumulativeFrac = useMemo(() => {
    if (projected.length < 2) return [] as number[]
    const legLens = projected.slice(0, -1).map((p, i) => Math.hypot(projected[i + 1][0] - p[0], projected[i + 1][1] - p[1]))
    const total = legLens.reduce((a, b) => a + b, 0) || 1
    let acc = 0
    const fracs = [0]
    for (const len of legLens) { acc += len; fracs.push(acc / total) }
    return fracs
  }, [projected])

  const [visited, setVisited] = useState<Set<number>>(new Set())
  const [plane, setPlane] = useState<{ x: number; y: number; angle: number } | null>(null)
  const [dashOffset, setDashOffset] = useState(1)

  useEffect(() => {
    if (waypoints.length < 2 || projected.length < 2) return

    if (reducedMotion) {
      setVisited(new Set(waypoints.map((_, i) => i)))
      setDashOffset(0)
      const last = projected[projected.length - 1]
      setPlane({ x: last[0], y: last[1], angle: 0 })
      return
    }

    let cancelled = false
    async function run() {
      while (!cancelled && pathRef.current) {
        const totalLen = pathRef.current.getTotalLength()
        setVisited(new Set([0]))
        setDashOffset(1)
        progress.set(0)
        await animate(progress, 1, {
          duration: Math.max(2, totalLen / SPEED_PX_PER_SEC),
          ease: 'linear',
          onUpdate: t => {
            const node = pathRef.current
            if (!node) return
            const len = t * totalLen
            const pt = node.getPointAtLength(len)
            const pt2 = node.getPointAtLength(Math.min(len + 1, totalLen))
            const angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI
            setPlane({ x: pt.x, y: pt.y, angle })
            setDashOffset(1 - t)
            setVisited(prev => {
              let changed = false
              const next = new Set(prev)
              // Pinta a bandeira um pouco antes da chegada exata (~4% do
              // trajeto total antes do ponto) — dá a sensação de "chegando".
              cumulativeFrac.forEach((frac, i) => {
                if (t >= frac - 0.04 && !next.has(i)) { next.add(i); changed = true }
              })
              return changed ? next : prev
            })
          },
        }).finished.catch(() => {})
        if (cancelled) return
        await new Promise(r => setTimeout(r, PAUSE_AT_STOP_MS))
        if (cancelled) return
        await new Promise(r => setTimeout(r, PAUSE_FULL_LAP_MS))
      }
    }
    run()
    return () => { cancelled = true }
  }, [routeD, waypoints.length, projected, cumulativeFrac, reducedMotion, progress])

  if (waypoints.length < 2) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground text-center px-6 rounded-lg border bg-muted/20">
        Adicione a origem e ao menos 1 parada reconhecida pra ver a animação.
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg border overflow-hidden">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto block">
        <defs>
          {flagPatterns.map(p => (
            <pattern key={p.iso2} id={`animated-map-flag-${p.iso2}`} patternUnits="userSpaceOnUse" x={p.x} y={p.y} width={p.width || 1} height={p.height || 1}>
              <image href={`https://flagcdn.com/w320/${p.iso2}.png`} x={0} y={0} width={p.width || 1} height={p.height || 1} preserveAspectRatio="none" />
            </pattern>
          ))}
        </defs>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={OCEAN_COLOR} />
        <g>
          {WORLD_FEATURES.map((f, i) => {
            const match = waypoints.find(w => w.enName === f.properties?.name)
            const isVisited = !!match && visited.has(waypoints.indexOf(match))
            return (
              <path
                key={i}
                d={geoPathFn(f) || ''}
                fill={isVisited && match ? `url(#animated-map-flag-${match.iso2})` : LAND_COLOR}
                stroke={OCEAN_COLOR}
                strokeWidth={0.6}
                style={{ transition: 'fill 0.5s ease' }}
              />
            )
          })}
        </g>
        <path
          ref={pathRef}
          d={routeD}
          fill="none"
          stroke="#ff6a00"
          strokeWidth={2}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.02 0.014"
          style={{ strokeDashoffset: dashOffset }}
        />
        {projected.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill="#ff6a00" stroke="white" strokeWidth={1} />
        ))}
        {plane && (
          <foreignObject x={plane.x - 12} y={plane.y - 12} width={24} height={24} style={{ overflow: 'visible' }}>
            <div style={{ transform: `rotate(${plane.angle}deg)`, transformOrigin: '12px 12px' }}>
              <Plane className="w-6 h-6 drop-shadow" style={{ color: '#ff6a00' }} fill="currentColor" />
            </div>
          </foreignObject>
        )}
      </svg>
      <div className="px-3 py-2 border-t bg-background/60 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {waypoints.map((w, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className={visited.has(i) ? 'text-foreground font-medium' : ''}>{w.label}</span>
            {i < waypoints.length - 1 && <span aria-hidden>→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
