import { cn } from "@/lib/utils"

interface SpinnerProps {
  size?: "default" | "sm" | "lg"
  className?: string
}

export function Spinner({ size = "default", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-current border-t-transparent",
        size === "default" && "h-6 w-6",
        size === "sm" && "h-4 w-4",
        size === "lg" && "h-8 w-8",
        className
      )}
    >
      <span className="sr-only">Cargando...</span>
    </div>
  )
} 