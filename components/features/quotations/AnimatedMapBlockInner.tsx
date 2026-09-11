'use client'

/**
 * Mapa animado da cotação — avião voando origem → paradas → origem (loop
 * contínuo), deixando um rastro tracejado e pintando cada país visitado com
 * a bandeira dele. Renderizado tanto no preview do editor quanto no link
 * público (mesmo componente, só a origem dos dados muda).
 *
 * Posição/rotação do avião usam a API nativa `getPointAtLength`/
 * `getTotalLength` do SVG sobre um único `<path>` cobrindo a rota inteira
 * (curvas suaves entre pontos) — evita reimplementar matemática de bezier
 * pra achar posição/ângulo a cada frame. "País visitado" (pra pintar a
 * bandeira) usa uma fração de tempo aproximada por distância em linha reta
 * entre os pontos — só cosmético, não precisa ser exato.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { animate, useMotionValue, useReducedMotion } from 'framer-motion'
import { Plane } from 'lucide-react'
import worldTopo from 'world-atlas/countries-110m.json'
import { resolveCountry } from '@/lib/geo/countries'
import { CITIES_BY_ISO2 } from '@/lib/geo/cities'

export type AnimatedMapPoint = { country: string; city?: string | null }
export type AnimatedMapRoute = { origin: AnimatedMapPoint; stops: AnimatedMapPoint[] }

type Waypoint = { label: string; lat: number; lng: number; iso2: string; enName?: string }

function resolveWaypoint(point: AnimatedMapPoint): Waypoint | null {
  const info = resolveCountry(point.country)
  if (!info) return null
  const cityName = point.city?.trim()
  const cityMatch = cityName
    ? CITIES_BY_ISO2[info.iso2]?.find(c => c.name.toLowerCase() === cityName.toLowerCase())
    : null
  return {
    label: cityName ? `${cityName}, ${info.name}` : info.name,
    lat: cityMatch?.lat ?? info.lat,
    lng: cityMatch?.lng ?? info.lng,
    iso2: info.iso2,
    enName: info.enName,
  }
}

// Casts largos (topojson não tem tipos fortes praticados neste repo) — uso
// único e local, não vaza pro resto do app.
const WORLD_FEATURES = (feature(worldTopo as any, (worldTopo as any).objects.countries) as any).features as any[]

const WIDTH = 800
const HEIGHT = 420
const SPEED_PX_PER_SEC = 140
const PAUSE_AT_STOP_MS = 700
const PAUSE_FULL_LAP_MS = 1400

export default function AnimatedMapBlockInner({ route }: { route: AnimatedMapRoute | null }) {
  const reducedMotion = useReducedMotion()
  const pathRef = useRef<SVGPathElement>(null)
  const progress = useMotionValue(0)

  const waypoints = useMemo(() => {
    if (!route?.origin?.country) return []
    return [route.origin, ...(route.stops || [])]
      .map(resolveWaypoint)
      .filter((w): w is Waypoint => !!w)
  }, [route])

  const projection = useMemo(() => geoEqualEarth().fitSize([WIDTH, HEIGHT], { type: 'Sphere' } as any), [])
  const geoPathFn = useMemo(() => geoPath(projection), [projection])

  const projected = useMemo(
    () => waypoints.map(w => projection([w.lng, w.lat])).filter((p): p is [number, number] => !!p),
    [waypoints, projection],
  )

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
              cumulativeFrac.forEach((frac, i) => {
                if (t >= frac - 0.001 && !next.has(i)) { next.add(i); changed = true }
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

  const flagIso2 = Array.from(new Set(waypoints.map(w => w.iso2)))

  return (
    <div className="w-full rounded-lg border bg-muted/10 overflow-hidden">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto block">
        <defs>
          {flagIso2.map(iso2 => (
            <pattern key={iso2} id={`animated-map-flag-${iso2}`} patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width={1} height={1}>
              <image href={`https://flagcdn.com/w320/${iso2}.png`} x={0} y={0} width={1} height={1} preserveAspectRatio="none" />
            </pattern>
          ))}
        </defs>
        <g>
          {WORLD_FEATURES.map((f, i) => {
            const match = waypoints.find(w => w.enName === f.properties?.name)
            const isVisited = !!match && visited.has(waypoints.indexOf(match))
            return (
              <path
                key={i}
                d={geoPathFn(f) || ''}
                fill={isVisited && match ? `url(#animated-map-flag-${match.iso2})` : 'hsl(var(--muted-foreground) / 0.18)'}
                stroke="hsl(var(--background))"
                strokeWidth={0.5}
                style={{ transition: 'fill 0.5s ease' }}
              />
            )
          })}
        </g>
        <path
          ref={pathRef}
          d={routeD}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.02 0.014"
          style={{ strokeDashoffset: dashOffset }}
        />
        {projected.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill="hsl(var(--primary))" stroke="white" strokeWidth={1} />
        ))}
        {plane && (
          <foreignObject x={plane.x - 12} y={plane.y - 12} width={24} height={24} style={{ overflow: 'visible' }}>
            <div style={{ transform: `rotate(${plane.angle}deg)`, transformOrigin: '12px 12px' }}>
              <Plane className="w-6 h-6 text-primary drop-shadow" fill="currentColor" />
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
