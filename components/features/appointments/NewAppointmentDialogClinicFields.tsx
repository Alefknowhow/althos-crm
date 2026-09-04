'use client'

import { Label } from '@/components/ui/label'

type ClinicOption = { id: string; name: string }

/**
 * Profissional/sala selects shown only for clinic-niche orgs.
 * Split out of NewAppointmentDialog.tsx.
 */
export function NewAppointmentDialogClinicFields({
  clinicProfessionals, clinicRooms, professionalId, roomId, restrictedProfessionalId,
  onProfessionalChange, onRoomChange,
}: {
  clinicProfessionals: ClinicOption[]
  clinicRooms: ClinicOption[]
  professionalId: string
  roomId: string
  restrictedProfessionalId: string | null
  onProfessionalChange: (id: string) => void
  onRoomChange: (id: string) => void
}) {
  if (clinicProfessionals.length === 0 && clinicRooms.length === 0) return null

  const availableProfessionals = restrictedProfessionalId
    ? clinicProfessionals.filter(p => p.id === restrictedProfessionalId)
    : clinicProfessionals

  return (
    <div className="grid grid-cols-2 gap-3">
      {clinicProfessionals.length > 0 && (
        <div className="space-y-2">
          <Label>Profissional</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
            value={professionalId}
            onChange={e => onProfessionalChange(e.target.value)}
            disabled={!!restrictedProfessionalId}
            title={restrictedProfessionalId ? 'Esse procedimento só pode ser feito por este profissional' : undefined}
          >
            <option value="">Sem profissional definido</option>
            {availableProfessionals.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      {clinicRooms.length > 0 && (
        <div className="space-y-2">
          <Label>Sala</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
            value={roomId}
            onChange={e => onRoomChange(e.target.value)}
          >
            <option value="">Sem sala definida</option>
            {clinicRooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
