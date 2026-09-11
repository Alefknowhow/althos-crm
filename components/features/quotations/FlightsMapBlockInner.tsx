'use client'

/**
 * Mapa de rota de voos (Cotações → aba Voos) — desenha, de uma vez só, o
 * trajeto de todos os voos já cadastrados (origem/conexão/destino), com uma
 * cor por grupo (ida/volta) e legenda no rodapé. Diferente do Mapa animado
 * de Conteúdo: aqui não há câmera se movendo nem revelação progressiva —
 * tudo já sai desenhado, enquadrado (4:5) só na área onde os voos
 * acontecem. Um aviãozinho decorativo sobrevoa as rotas já desenhadas em
 * loop, só de enfeite (sem efeito no que já está pintado).
 *
 * Mesma base de terreno (textura de satélite + país pintado com bandeira
 * quando reconhecido) do Mapa animado de Conteúdo — ver comentário em
 * AnimatedMapBlockInner.tsx pros detalhes de projeção equiretangular e do
 * pattern de bandeira via bounding box real.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { animate, useReducedMotion } from 'framer-motion'
import { Plane } from 'lucide-react'
import worldTopo from 'world-atlas/countries-110m.json'
import { GROUP_COLORS, GROUP_LABELS, foreignCountriesInLegs, type ResolvedLeg } from '@/lib/geo/flightRoute'

const WORLD_FEATURES = (feature(worldTopo as any, (worldTopo as any).objects.countries) as any).features as any[]

// 4:5 — um pouco mais vertical, conforme pedido.
const WIDTH = 480
const HEIGHT = 600
const ASPECT = WIDTH / HEIGHT
const OCEAN_COLOR = '#0b3d5c'
const EARTH_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Land_ocean_ice_2048.jpg'
const PLANE_ICON_OFFSET_DEG = 45
const SPEED_PX_PER_SEC = 120
const LOOP_PAUSE_MS = 1000
const MIN_CAMERA_W = 140
const PADDING_FRAC = 0.22

export default function FlightsMapBlockInner({ legs }: { legs: ResolvedLeg[] }) {
  const reducedMotion = useReducedMotion()
  const pathRef = useRef<SVGPathElement>(null)
  const [plane, setPlane] = useState<{ x: number; y: number; angle: number } | null>(null)

  const projection = useMemo(() => geoEquirectangular().fitSize([WIDTH, HEIGHT], { type: 'Sphere' } as any), [])
  const geoPathFn = useMemo(() => geoPath(projection), [projection])

  const points = useMemo(
    () => legs.flatMap(leg => [projection([leg.from.lng, leg.from.lat]), projection([leg.to.lng, leg.to.lat])]).filter((p): p is [number, number] => !!p),
    [legs, projection],
  )

  // Câmera fixa: enquadra só a área onde os voos acontecem, sempre em 4:5 (sem letterbox).
  const camera = useMemo(() => {
    if (points.length === 0) return { x: 0, y: 0, w: WIDTH, h: HEIGHT }
    const xs = points.map(p => p[0]), ys = points.map(p => p[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const padX = Math.max((maxX - minX) * PADDING_FRAC, 24)
    const padY = Math.max((maxY - minY) * PADDING_FRAC, 24)
    const boxW = maxX - minX + padX * 2
    const boxH = maxY - minY + padY * 2
    let w = Math.max(boxW, boxH * ASPECT, MIN_CAMERA_W)
    let h = w / ASPECT
    if (h < boxH) { h = boxH; w = h * ASPECT }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    w = Math.min(w, WIDTH); h = Math.min(h, HEIGHT)
    return {
      x: Math.min(Math.max(cx - w / 2, 0), WIDTH - w),
      y: Math.min(Math.max(cy - h / 2, 0), HEIGHT - h),
      w, h,
    }
  }, [points])

  // Bounding box real de cada país estrangeiro presente nos voos, pra
  // recortar o <pattern> da bandeira nele — mesma técnica de AnimatedMapBlockInner.
  const foreignCountries = useMemo(() => foreignCountriesInLegs(legs), [legs])
  const flagPatterns = useMemo(() => {
    return foreignCountries
      .map(c => {
        const f = WORLD_FEATURES.find(feat => feat.properties?.name === c.enName)
        if (!f) return null
        const bounds = geoPathFn.bounds(f)
        return { iso2: c.iso2, x: bounds[0][0], y: bounds[0][1], width: bounds[1][0] - bounds[0][0], height: bounds[1][1] - bounds[0][1] }
      })
      .filter((p): p is { iso2: string; x: number; y: number; width: number; height: number } => !!p)
  }, [foreignCountries, geoPathFn])

  const legsD = useMemo(() => {
    return legs.map(leg => {
      const from = projection([leg.from.lng, leg.from.lat])
      const to = projection([leg.to.lng, leg.to.lat])
      if (!from || !to) return null
      const [x1, y1] = from, [x2, y2] = to
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
      const dx = x2 - x1, dy = y2 - y1
      const dist = Math.hypot(dx, dy) || 1
      const bow = Math.min(40, dist * 0.2)
      const cx = mx - (dy / dist) * bow
      const cy = my + (dx / dist) * bow
      return { d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, group: leg.group }
    }).filter((l): l is { d: string; group: 'outbound' | 'inbound' } => !!l)
  }, [legs, projection])

  // Rastro único (todas as pernas concatenadas, na ordem cadastrada) só pro
  // avião decorativo percorrer — múltiplos "M" na mesma <path> são
  // subtrajetos válidos; getPointAtLength avança por eles em sequência.
  const fullPathD = useMemo(() => legsD.map(l => l.d).join(' '), [legsD])

  useEffect(() => {
    if (reducedMotion || legsD.length === 0) { setPlane(null); return }
    let cancelled = false
    async function run() {
      while (!cancelled && pathRef.current) {
        const totalLen = pathRef.current.getTotalLength()
        if (totalLen === 0) return
        const controls = animate(0, 1, {
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
          },
        })
        await controls.finished.catch(() => {})
        if (cancelled) return
        await new Promise(r => setTimeout(r, LOOP_PAUSE_MS))
      }
    }
    run()
    return () => { cancelled = true }
  }, [fullPathD, legsD.length, reducedMotion])

  if (legsD.length === 0) {
    return (
      <div className="aspect-[4/5] w-full max-w-[320px] mx-auto flex items-center justify-center text-sm text-muted-foreground text-center px-6 rounded-lg border bg-muted/20">
        Cadastre ao menos um voo com sigla de aeroporto reconhecida pra ver o mapa da rota.
      </div>
    )
  }

  const groupsPresent = Array.from(new Set(legs.map(l => l.group)))

  return (
    <div className="w-full max-w-[320px] mx-auto rounded-lg border overflow-hidden">
      <svg viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`} className="w-full h-auto block">
        <defs>
          {flagPatterns.map(p => (
            <pattern key={p.iso2} id={`flights-map-flag-${p.iso2}`} patternUnits="userSpaceOnUse" x={p.x} y={p.y} width={p.width || 1} height={p.height || 1}>
              <image href={`https://flagcdn.com/w320/${p.iso2}.png`} x={0} y={0} width={p.width || 1} height={p.height || 1} preserveAspectRatio="none" />
            </pattern>
          ))}
        </defs>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={OCEAN_COLOR} />
        <image href={EARTH_TEXTURE_URL} x={0} y={0} width={WIDTH} height={HEIGHT} preserveAspectRatio="none" />
        <g>
          {WORLD_FEATURES.map((f, i) => {
            const match = foreignCountries.find(c => c.enName === f.properties?.name)
            return (
              <path
                key={i}
                d={geoPathFn(f) || ''}
                fill={match ? `url(#flights-map-flag-${match.iso2})` : 'transparent'}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={0.5}
              />
            )
          })}
        </g>
        {legsD.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={3.5} strokeLinecap="round" />
        ))}
        {legsD.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke={GROUP_COLORS[l.group]} strokeWidth={2} strokeLinecap="round" strokeDasharray="6 5" />
        ))}
        <path ref={pathRef} d={fullPathD} fill="none" stroke="none" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="#ffffff" stroke="rgba(0,0,0,0.45)" strokeWidth={1.2} />
        ))}
        {plane && (
          <foreignObject x={plane.x - 11} y={plane.y - 11} width={22} height={22} style={{ overflow: 'visible' }}>
            <div style={{ transform: `rotate(${plane.angle + PLANE_ICON_OFFSET_DEG}deg)`, transformOrigin: '11px 11px' }}>
              <Plane className="w-[22px] h-[22px]" style={{ color: '#ffffff', filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.6))' }} fill="currentColor" />
            </div>
          </foreignObject>
        )}
      </svg>
      <div className="px-3 py-2 border-t bg-background/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {groupsPresent.map(g => (
          <span key={g} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: GROUP_COLORS[g] }} />
            {GROUP_LABELS[g]}
          </span>
        ))}
      </div>
    </div>
  )
}
