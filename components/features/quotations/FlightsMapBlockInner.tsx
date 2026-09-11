'use client'

/**
 * Mapa de rota de voos (Cotações → aba Voos) — desenha o trajeto de todos
 * os voos já cadastrados (origem/conexão/destino) sobre o Google Maps de
 * verdade (mesma API já usada pelo mapa de pins em PublicQuotationView.tsx
 * — `ensureMapsOptions`/`importLibrary`), com uma cor por grupo (ida/volta)
 * e legenda no canto. Câmera ajusta (`fitBounds`) só na área dos voos.
 *
 * Trocado do mapa vetorial/satélite customizado (SVG + d3-geo) pro Google
 * Maps real por pedido explícito — o resultado visual esperado (ruas,
 * rótulos de cidade, controle de zoom, pino padrão) é o próprio estilo do
 * Google Maps, então gerar isso à mão em SVG só pra imitar nunca ficaria
 * idêntico. `AnimatedMapBlockInner.tsx` (Conteúdo) continua vetorial —
 * esse é decorativo/global, não faz sentido carregar Maps API só pra ele.
 */

import { useEffect, useRef } from 'react'
import { importLibrary } from '@googlemaps/js-api-loader'
import { ensureMapsOptions } from './PublicQuotationHelpers'
import { GROUP_COLORS, GROUP_LABELS, type ResolvedLeg, type RouteGroup } from '@/lib/geo/flightRoute'

type LatLng = { lat: number; lng: number }

function circleMarkerIcon(): string {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">'
    + '<circle cx="11" cy="11" r="8.5" fill="#ffffff" stroke="#3c4043" stroke-width="2"/>'
    + '<circle cx="11" cy="11" r="3" fill="#3c4043"/></svg>'
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

/** Curva suave entre dois pontos (bow perpendicular à linha reta), em
 *  lat/lng — decorativo, não representa a rota real da aeronave (mesmo
 *  disclaimer que apps de companhia aérea mostram nesses mapas). */
function curvedPath(from: LatLng, to: LatLng, steps = 24): LatLng[] {
  const dLat = to.lat - from.lat, dLng = to.lng - from.lng
  const dist = Math.hypot(dLat, dLng) || 1
  const bow = Math.min(dist * 0.22, 5)
  const nx = -dLng / dist, ny = dLat / dist
  const midLat = (from.lat + to.lat) / 2 + ny * bow
  const midLng = (from.lng + to.lng) / 2 + nx * bow
  const pts: LatLng[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, omt = 1 - t
    pts.push({ lat: omt * omt * from.lat + 2 * omt * t * midLat + t * t * to.lat, lng: omt * omt * from.lng + 2 * omt * t * midLng + t * t * to.lng })
  }
  return pts
}

export default function FlightsMapBlockInner({ legs }: { legs: ResolvedLeg[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<google.maps.Map | null>(null)

  useEffect(() => {
    if (legs.length === 0 || !mapRef.current) return
    let cancelled = false
    ;(async () => {
      ensureMapsOptions()
      const [{ Map, Polyline }, { Marker }, { LatLngBounds, Size, Point }] = await Promise.all([
        importLibrary('maps') as Promise<google.maps.MapsLibrary>,
        importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
        importLibrary('core') as Promise<google.maps.CoreLibrary>,
      ])
      if (cancelled || !mapRef.current) return
      const map = new Map(mapRef.current, {
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false,
      })
      mapObj.current = map

      const bounds = new LatLngBounds()
      const seen = new Set<string>()
      const icon = { url: circleMarkerIcon(), scaledSize: new Size(22, 22), anchor: new Point(11, 11) }

      for (const leg of legs) {
        for (const pt of [leg.from, leg.to]) {
          const key = `${pt.lat},${pt.lng}`
          if (seen.has(key)) continue
          seen.add(key)
          new Marker({ position: { lat: pt.lat, lng: pt.lng }, map, icon, title: leg.isConnection ? 'Conexão' : undefined })
          bounds.extend({ lat: pt.lat, lng: pt.lng })
        }
        new Polyline({
          path: curvedPath({ lat: leg.from.lat, lng: leg.from.lng }, { lat: leg.to.lat, lng: leg.to.lng }),
          map,
          strokeOpacity: 0,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3, strokeColor: GROUP_COLORS[leg.group] },
            offset: '0', repeat: '14px',
          }],
        })
      }
      map.fitBounds(bounds, 48)
    })()
    return () => { cancelled = true; mapObj.current = null }
  }, [legs])

  if (legs.length === 0) {
    return (
      <div className="h-[220px] w-full flex items-center justify-center text-sm text-muted-foreground text-center px-6 rounded-lg border bg-muted/20">
        Cadastre ao menos um voo com sigla de aeroporto reconhecida pra ver o mapa da rota.
      </div>
    )
  }

  const groupsPresent = Array.from(new Set(legs.map(l => l.group))) as RouteGroup[]

  return (
    <div className="w-full rounded-lg border overflow-hidden">
      <div className="relative">
        <div ref={mapRef} className="w-full h-[320px]" />
        <div className="absolute bottom-2 right-2 bg-white/95 rounded-md shadow px-2.5 py-1.5 text-[11px] text-[#3c4043] flex items-center gap-3 pointer-events-none">
          {groupsPresent.map(g => (
            <span key={g} className="flex items-center gap-1.5">
              <span className="w-3 h-[3px] rounded-sm inline-block" style={{ backgroundColor: GROUP_COLORS[g] }} />
              {GROUP_LABELS[g]}
            </span>
          ))}
        </div>
      </div>
      <p className="px-3 py-1.5 text-[10px] italic text-destructive/80 bg-background/60 border-t">
        *As linhas do trajeto entre os aeroportos exibidas neste mapa podem não representar exatamente o trajeto que a aeronave executará.
      </p>
    </div>
  )
}
