import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    switchSize?: "default" | "sm"
  }
>(({ className, switchSize = "default", ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      switchSize === "sm" ? "h-4 w-7" : "h-5 w-9",
      "data-[state=checked]:bg-[#34B27B] data-[state=unchecked]:bg-[#23232a]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block rounded-full ring-0 transition-transform",
        switchSize === "sm"
          ? "h-3 w-3 shadow-sm data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0"
          : "h-4 w-4 shadow-lg data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        "bg-[#f5f5f7] dark:bg-[#23232a]",
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
