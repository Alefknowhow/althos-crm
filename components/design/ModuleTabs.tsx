'use client'

/**
 * Abas horizontais internas de módulo (padrão do Design System, issue #60
 * Fase C.1) — segmented control: container arredondado com fundo sutil,
 * pílula ativa preenchida com sombra, só texto (sem ícone), rolagem
 * horizontal em telas estreitas em vez de quebrar linha.
 *
 * Envolve os primitives de @/components/ui/tabs (gerado, não editar) só com
 * className — o pill/indicador animado já vem de lá.
 */

import * as React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const ModuleTabs = Tabs

const ModuleTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  React.ComponentPropsWithoutRef<typeof TabsList>
>(({ className, ...props }, ref) => (
  <div className="overflow-x-auto">
    <TabsList ref={ref} className={cn('w-max min-w-full sm:w-auto', className)} {...props} />
  </div>
))
ModuleTabsList.displayName = 'ModuleTabsList'

const ModuleTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, ...props }, ref) => (
  <TabsTrigger ref={ref} className={cn('shrink-0', className)} {...props} />
))
ModuleTabsTrigger.displayName = 'ModuleTabsTrigger'

const ModuleTabsContent = TabsContent

export { ModuleTabs, ModuleTabsList, ModuleTabsTrigger, ModuleTabsContent }
