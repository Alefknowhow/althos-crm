'use client'

/**
 * Tela de demonstração da camada mobile Material 3 (reformulação mobile,
 * G1) — não é um módulo do produto, é a base pequena e revisável pedida no
 * prompt G1 antes de migrar qualquer tela real. Rota interna, sem link
 * nenhum apontando pra ela; acessível só digitando a URL.
 */

import { useState } from 'react'
import { MobileShell } from '@/components/features/mobile/MobileShell'
import { MobileButton } from '@/components/features/mobile/MobileButton'
import { MobileIconButton } from '@/components/features/mobile/MobileIconButton'
import { MobileTextField } from '@/components/features/mobile/MobileTextField'
import { MobileCard } from '@/components/features/mobile/MobileCard'
import { MobileListItem } from '@/components/features/mobile/MobileListItem'
import { MobileBottomSheet } from '@/components/features/mobile/MobileBottomSheet'
import { Search, Bell, MoreVertical } from 'lucide-react'

export default function MobileDemoPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [name, setName] = useState('')

  return (
    <MobileShell className="p-4 space-y-6 max-w-md mx-auto">
      <div>
        <h2 className="text-[22px] leading-7 font-medium text-m3-on-surface">Camada mobile M3</h2>
        <p className="text-sm text-m3-on-surface-variant mt-1">Base de tokens + primitives — nada disto é um módulo real do CRM.</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-base font-medium">Botões</h3>
        <div className="flex flex-wrap gap-2">
          <MobileButton variant="filled">Salvar</MobileButton>
          <MobileButton variant="tonal">Filtrar</MobileButton>
          <MobileButton variant="outlined">Cancelar</MobileButton>
          <MobileButton variant="text">Ver mais</MobileButton>
          <MobileIconButton aria-label="Buscar"><Search className="w-6 h-6" /></MobileIconButton>
          <MobileIconButton aria-label="Notificações"><Bell className="w-6 h-6" /></MobileIconButton>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-medium">Campo</h3>
        <MobileTextField
          label="Nome do contato"
          hint="Como aparece na lista"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex.: Maria Silva"
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-medium">KPI</h3>
        <MobileCard>
          <p className="text-sm text-m3-on-surface-variant">Receita do mês</p>
          <p className="text-2xl font-medium tabular-nums text-m3-on-surface">R$ 42.180,00</p>
          <p className="text-sm text-success mt-1">+12% vs. mês anterior</p>
        </MobileCard>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-medium">Lista</h3>
        <MobileCard className="p-0 divide-y divide-m3-outline-variant/60">
          <MobileListItem title="Maria Silva" subtitle="Vencido há 2 dias" onClick={() => {}} />
          <MobileListItem
            title="João Pereira"
            subtitle="Hoje, 14:30"
            trailing={<MobileIconButton aria-label="Mais ações" onClick={() => setSheetOpen(true)}><MoreVertical className="w-5 h-5" /></MobileIconButton>}
          />
        </MobileCard>
      </section>

      <MobileButton variant="outlined" onClick={() => setSheetOpen(true)}>Abrir bottom sheet</MobileButton>

      <MobileBottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Mais ações do lead">
        <div className="space-y-1">
          <MobileListItem title="Consultar/compartilhar" onClick={() => setSheetOpen(false)} />
          <MobileListItem title="Editar" onClick={() => setSheetOpen(false)} />
          <MobileListItem title="Excluir" onClick={() => setSheetOpen(false)} />
        </div>
      </MobileBottomSheet>
    </MobileShell>
  )
}
