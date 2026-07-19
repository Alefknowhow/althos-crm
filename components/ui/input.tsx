import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Carbon input: flat surface, hairline border, 2px blue underline on
          // focus (no ring/glow) — border-b thickens instead of a box-shadow.
          "flex h-10 w-full rounded-none border border-input border-b-2 bg-muted/40 px-3.5 py-2 text-base tracking-apple-snug transition-colors duration-100 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-b-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
