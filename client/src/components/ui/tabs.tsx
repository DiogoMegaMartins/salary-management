import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // separadores com linha por baixo: o ativo fica a verde; se não couberem, deslocam na horizontal (sem quebrar linha)
      "flex h-auto w-full touch-pan-x items-stretch justify-start gap-0 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-transparent shadow-[inset_0_-1px_0_var(--color-border)] p-0 text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, onClick, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    // numa lista que desloca na horizontal, traz o separador escolhido para a vista
    onClick={(e) => {
      onClick?.(e)
      // só desloca a própria barra na horizontal: scrollIntoView também mexia na página (vertical)
      const el = e.currentTarget
      const list = el.closest<HTMLElement>('[role="tablist"]')
      if (list && list.scrollWidth > list.clientWidth)
        list.scrollTo?.({ left: el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2, behavior: "smooth" })
    }}
    className={cn(
      "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-primary",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
