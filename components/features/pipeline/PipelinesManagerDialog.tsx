'use client'

import { useState } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Settings } from 'lucide-react'
import PipelinesManager from './PipelinesManager'

type Pipeline = { id: string; name: string; is_default: boolean; stage_count: number; lead_count: number }

/** Popup de "Gerenciar pipelines" (criar/renomear/definir padrão/excluir) —
 *  antes vivia numa página separada em Configurações; agora abre direto de
 *  dentro da própria tela de Pipeline, sem navegar pra outro lugar.
 *  `trigger` deixa o botão customizável (ícone só no toolbar, ou um CTA de
 *  texto no estado vazio "nenhum pipeline configurado"). */
export default function PipelinesManagerDialog({
  orgSlug, pipelines, trigger, triggerLabel,
}: {
  orgSlug: string
  pipelines: Pipeline[]
  trigger?: 'icon' | 'button'
  triggerLabel?: string
}) {
  const [open, setOpen] = useState(false)

  const buttonProps: ButtonProps = trigger === 'button'
    ? { variant: 'default' }
    : { variant: 'ghost', size: 'icon', className: 'h-8 w-8' }

  return (
    <>
      <Button {...buttonProps} title="Gerenciar pipelines" onClick={() => setOpen(true)}>
        <Settings className={trigger === 'button' ? 'w-4 h-4 mr-1.5' : 'w-4 h-4'} />
        {trigger === 'button' && (triggerLabel || 'Gerenciar pipelines')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar pipelines</DialogTitle>
          </DialogHeader>
          <PipelinesManager orgSlug={orgSlug} initial={pipelines} />
        </DialogContent>
      </Dialog>
    </>
  )
}
