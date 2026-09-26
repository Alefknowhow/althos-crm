'use client'

/**
 * Abas horizontais internas de módulo (padrão do Design System, issue #60
 * Fase C.1) — segmented control: container arredondado com fundo sutil,
 * pílula ativa com cantos mais quadrados e contraste forte (fundo +
 * sombra + contorno), só texto (sem ícone), rolagem horizontal em telas
 * estreitas em vez de quebrar linha.
 *
 * List/Trigger são construídos direto sobre o Radix (não sobre
 * @/components/ui/tabs) de propósito: ui/tabs.tsx é compartilhado por TODOS
 * os outros usos de abas do app (diálogos, formulários) e usa um indicador
 * animado com cantos arredondados (rounded-full) fixo internamente — não dá
 * pra sobrescrever só esse cantoneira via className sem editar o arquivo
 * gerado. Construindo aqui do zero, o visual "cantos quadrados, pílula com
 * mais destaque" fica isolado só nas abas internas de módulo, sem afetar
 * nada mais no app. Tabs/TabsContent (sem estilo de pílula) continuam
 * vindo de ui/tabs.tsx normalmente.
 */

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const ModuleTabs = Tabs

const ModuleTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="overflow-x-auto">
    <TabsPrimitive.List
      ref={ref}
      className={cn('inline-flex w-max min-w-full sm:w-auto items-center gap-1 rounded-lg bg-muted p-1', className)}
      {...props}
    />
  </div>
))
ModuleTabsList.displayName = 'ModuleTabsList'

const ModuleTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
      'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border',
      className,
    )}
    {...props}
  />
))
ModuleTabsTrigger.displayName = 'ModuleTabsTrigger'

const ModuleTabsContent = TabsContent

export { ModuleTabs, ModuleTabsList, ModuleTabsTrigger, ModuleTabsContent }
