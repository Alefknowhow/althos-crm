'use client'

import TrackingHealthCard, { type TrackingHealthData } from '@/components/features/trafego/TrackingHealthCard'

export default function PortalTrackingTab({ health }: { health: TrackingHealthData }) {
  return <TrackingHealthCard health={health} />
}
