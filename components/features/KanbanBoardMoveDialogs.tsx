'use client'

/**
 * Lost/Won/Negotiation stage-move confirmation dialogs for KanbanBoard.
 * Prop-driven, split out of KanbanBoard.tsx.
 */

import { LostMoveDialog, WonValueDialog, NegotiationValueDialog } from './pipeline/StageMoveDialogs'

type MovePrompt = { leadId: string; newStageId: string; oldStageId: string }
type ValueMovePrompt = MovePrompt & { defaultCents: number }

export function KanbanBoardMoveDialogs({
  lostMovePrompt, setLostMovePrompt,
  wonMovePrompt, setWonMovePrompt,
  negotiationMovePrompt, setNegotiationMovePrompt,
  setLeads, commitStageMove,
}: {
  lostMovePrompt: MovePrompt | null
  setLostMovePrompt: (v: MovePrompt | null) => void
  wonMovePrompt: ValueMovePrompt | null
  setWonMovePrompt: (v: ValueMovePrompt | null) => void
  negotiationMovePrompt: ValueMovePrompt | null
  setNegotiationMovePrompt: (v: ValueMovePrompt | null) => void
  setLeads: (fn: (prev: any[]) => any[]) => void
  commitStageMove: (
    leadId: string,
    newStageId: string,
    oldStageId: string,
    closeInfo?: { dealStatus: 'perdido' | 'desqualificado'; reason: string },
    valueCents?: number,
  ) => void
}) {
  return (
    <>
      <LostMoveDialog
        open={!!lostMovePrompt}
        onCancel={() => {
          if (lostMovePrompt) {
            setLeads(prev => prev.map(l => (l.id === lostMovePrompt.leadId ? { ...l, stage_id: lostMovePrompt.oldStageId } : l)))
          }
          setLostMovePrompt(null)
        }}
        onConfirm={(dealStatus, reason) => {
          if (lostMovePrompt) {
            commitStageMove(lostMovePrompt.leadId, lostMovePrompt.newStageId, lostMovePrompt.oldStageId, { dealStatus, reason })
          }
          setLostMovePrompt(null)
        }}
      />

      <WonValueDialog
        open={!!wonMovePrompt}
        defaultCents={wonMovePrompt?.defaultCents}
        onCancel={() => {
          if (wonMovePrompt) {
            setLeads(prev => prev.map(l => (l.id === wonMovePrompt.leadId ? { ...l, stage_id: wonMovePrompt.oldStageId } : l)))
          }
          setWonMovePrompt(null)
        }}
        onConfirm={valueCents => {
          if (wonMovePrompt) {
            commitStageMove(wonMovePrompt.leadId, wonMovePrompt.newStageId, wonMovePrompt.oldStageId, undefined, valueCents)
          }
          setWonMovePrompt(null)
        }}
      />

      <NegotiationValueDialog
        open={!!negotiationMovePrompt}
        defaultCents={negotiationMovePrompt?.defaultCents}
        onCancel={() => {
          if (negotiationMovePrompt) {
            setLeads(prev => prev.map(l => (l.id === negotiationMovePrompt.leadId ? { ...l, stage_id: negotiationMovePrompt.oldStageId } : l)))
          }
          setNegotiationMovePrompt(null)
        }}
        onConfirm={valueCents => {
          if (negotiationMovePrompt) {
            commitStageMove(negotiationMovePrompt.leadId, negotiationMovePrompt.newStageId, negotiationMovePrompt.oldStageId, undefined, valueCents)
          }
          setNegotiationMovePrompt(null)
        }}
      />
    </>
  )
}
