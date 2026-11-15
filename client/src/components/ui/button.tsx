import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl border text-sm font-semibold tracking-[0.02em] ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] active:shadow-none",
  {
    variants: {
      variant: {
        default:
          "border-red-400/30 bg-red-600 text-white shadow-[0_10px_22px_-8px_rgba(239,68,68,0.55)] hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-[0_16px_28px_-10px_rgba(239,68,68,0.68)]",
        destructive:
          "border-red-900/50 bg-destructive text-destructive-foreground shadow-md shadow-red-950/30 hover:-translate-y-0.5 hover:bg-destructive/90",
        outline:
          "border-zinc-700/80 bg-zinc-950/85 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:-translate-y-0.5 hover:border-zinc-500 hover:bg-zinc-900",
        secondary:
          "border-zinc-700/70 bg-zinc-800 text-zinc-100 shadow-md shadow-black/30 hover:-translate-y-0.5 hover:bg-zinc-700",
        ghost: "border-transparent text-zinc-200 hover:bg-zinc-900/80 hover:text-white",
        link: "text-red-400 underline-offset-4 hover:text-red-300 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-9 text-base",
        icon: "h-10 w-10",
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

