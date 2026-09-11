'use client'

/**
 * Mapa de rota de voos (Cotações → aba Voos) — desenha, de uma vez só e sem
 * animação, o trajeto de todos os voos já cadastrados (origem/conexão/
 * destino), com uma cor por grupo (ida/volta) e legenda no rodapé.
 * Enquadramento fixo, só na área onde os voos acontecem — sem câmera se
 * movendo nem revelação progressiva. Pontos de conexão (quando a sigla da
 * escala é reconhecida) ganham um marcador diferente dos aeroportos de
 * origem/destino, pra ficar claro que ali é uma parada, não o fim da linha.
 *
 * Mesma base de terreno (textura de satélite + país pintado com bandeira
 * quando reconhecido) do Mapa animado de Conteúdo — ver comentário em
 * AnimatedMapBlockInner.tsx pros detalhes de projeção equiretangular e do
 * pattern de bandeira via bounding box real. Estados do Brasil vêm de um
 * GeoJSON próprio, simplificado (`lib/geo/brazil-states.json`) — o
 * `world-atlas` só tem fronteira de país, e voos domésticos (ex.: FLN↔SP)
 * ficavam sem nenhuma referência visual dentro do Brasil.
 */

import { useMemo } from 'react'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import worldTopo from 'world-atlas/countries-110m.json'
import brazilStates from '@/lib/geo/brazil-states.json'
import { GROUP_COLORS, GROUP_LABELS, foreignCountriesInLegs, type ResolvedLeg } from '@/lib/geo/flightRoute'

const WORLD_FEATURES = (feature(worldTopo as any, (worldTopo as any).objects.countries) as any).features as any[]
const BRAZIL_STATE_FEATURES = (brazilStates as any).features as any[]

// Mesma proporção do Mapa animado de Conteúdo (paisagem).
const WIDTH = 800
const HEIGHT = 420
const ASPECT = WIDTH / HEIGHT
const OCEAN_COLOR = '#0b3d5c'
const EARTH_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Land_ocean_ice_2048.jpg'
// Zoom mínimo baixo pra voos curtos (ex.: FLN↔SP) ficarem com o tracejado
// realmente visível em vez de um pontinho perdido no meio do mapa.
const MIN_CAMERA_W = 70
const PADDING_FRAC = 0.35

export default function FlightsMapBlockInner({ legs }: { legs: ResolvedLeg[] }) {
  const projection = useMemo(() => geoEquirectangular().fitSize([WIDTH, HEIGHT], { type: 'Sphere' } as any), [])
  const geoPathFn = useMemo(() => geoPath(projection), [projection])

  const points = useMemo(
    () => legs.flatMap(leg => [
      { p: projection([leg.from.lng, leg.from.lat]), isConnection: !!leg.isConnection },
      { p: projection([leg.to.lng, leg.to.lat]), isConnection: !!leg.isConnection },
    ]).filter((x): x is { p: [number, number]; isConnection: boolean } => !!x.p),
    [legs, projection],
  )

  // Câmera fixa: enquadra só a área onde os voos acontecem, mantendo a
  // proporção do canvas (sem letterbox).
  const camera = useMemo(() => {
    if (points.length === 0) return { x: 0, y: 0, w: WIDTH, h: HEIGHT }
    const xs = points.map(pt => pt.p[0]), ys = points.map(pt => pt.p[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const padX = Math.max((maxX - minX) * PADDING_FRAC, 20)
    const padY = Math.max((maxY - minY) * PADDING_FRAC, 20)
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

  if (legsD.length === 0) {
    return (
      <div className="h-[220px] w-full flex items-center justify-center text-sm text-muted-foreground text-center px-6 rounded-lg border bg-muted/20">
        Cadastre ao menos um voo com sigla de aeroporto reconhecida pra ver o mapa da rota.
      </div>
    )
  }

  const groupsPresent = Array.from(new Set(legs.map(l => l.group)))

  return (
    <div className="w-full rounded-lg border overflow-hidden">
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
        <g>
          {BRAZIL_STATE_FEATURES.map((f, i) => (
            <path key={i} d={geoPathFn(f) || ''} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.4} />
          ))}
        </g>
        {legsD.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={2} strokeLinecap="round" />
        ))}
        {legsD.map((l, i) => (
          <path key={i} d={l.d} fill="none" stroke={GROUP_COLORS[l.group]} strokeWidth={1} strokeLinecap="round" strokeDasharray="6 5" />
        ))}
        {points.map(({ p: [x, y], isConnection }, i) => (
          isConnection
            ? <rect key={i} x={x - 3.2} y={y - 3.2} width={6.4} height={6.4} fill="#ffd166" stroke="rgba(0,0,0,0.5)" strokeWidth={1} transform={`rotate(45 ${x} ${y})`} />
            : <circle key={i} cx={x} cy={y} r={3} fill="#ffffff" stroke="rgba(0,0,0,0.45)" strokeWidth={1.2} />
        ))}
      </svg>
      <div className="px-3 py-2 border-t bg-background/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {groupsPresent.map(g => (
          <span key={g} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: GROUP_COLORS[g] }} />
            {GROUP_LABELS[g]}
          </span>
        ))}
        {points.some(pt => pt.isConnection) && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 inline-block rotate-45" style={{ backgroundColor: '#ffd166' }} />
            Conexão
          </span>
        )}
      </div>
    </div>
  )
}
