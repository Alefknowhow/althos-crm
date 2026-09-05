import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium tracking-apple-tight transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Ação primária: preenchimento + glow sutil na cor do token, eleva 1px no hover.
        default: "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,.08),0_10px_24px_-8px_hsl(var(--primary)/0.45)] hover:bg-primary/85 hover:-translate-y-px",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/85",
        success: "bg-success text-success-foreground hover:bg-success/85",
        // Carbon "tertiary" — 1px border in the accent color, transparent fill.
        outline: "border border-primary text-primary bg-transparent hover:bg-primary/10",
        // Carbon "secondary" — flat neutral fill.
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        // Carbon "ghost".
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
        pill: "h-10 px-[22px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
