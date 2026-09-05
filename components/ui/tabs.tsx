"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

// Cada <TabsList> tem seu próprio layoutId de indicador (via useId), pra não
// animar entre instâncias de Tabs diferentes que existam na mesma tela.
const TabsListIdContext = React.createContext<string>("")

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const listId = React.useId()
  return (
    <TabsListIdContext.Provider value={listId}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
          className
        )}
        {...props}
      />
    </TabsListIdContext.Provider>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const listId = React.useContext(TabsListIdContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "group/tab relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=inactive]:font-medium",
        className
      )}
      {...props}
    >
      <TabsIndicator listId={listId} />
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

// Só o trigger ativo (via group-data-[state=active]) renderiza o motion.span
// visível — o layoutId compartilhado faz o framer-motion animar essa
// "pílula" deslizando de um trigger pro outro em vez de reaparecer instantânea.
function TabsIndicator({ listId }: { listId: string }) {
  return (
    <span className="absolute inset-0 hidden group-data-[state=active]/tab:block">
      <motion.span
        layoutId={`tab-indicator-${listId}`}
        className="absolute inset-0 rounded-md bg-background shadow"
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      />
    </span>
  )
}

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
