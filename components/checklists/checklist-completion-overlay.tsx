"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  title: string
  subtitle: string
  redirectPathLabel?: string
  countdownSeconds?: number
  onContinue: () => void
  primaryActionLabel?: string
}

export function ChecklistCompletionOverlay({
  open,
  title,
  subtitle,
  redirectPathLabel = "Inicio",
  countdownSeconds = 5,
  onContinue,
  primaryActionLabel = "Continuar",
}: Props) {
  const [seconds, setSeconds] = useState(countdownSeconds)
  const autoFiredRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setSeconds(countdownSeconds)
      autoFiredRef.current = false
      return
    }
    setSeconds(countdownSeconds)
    autoFiredRef.current = false

    const tick = setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)

    const redirect = window.setTimeout(() => {
      if (!autoFiredRef.current) {
        autoFiredRef.current = true
        onContinue()
      }
    }, countdownSeconds * 1000)

    return () => {
      clearInterval(tick)
      clearTimeout(redirect)
    }
  }, [open, countdownSeconds, onContinue])

  const handleManualContinue = () => {
    autoFiredRef.current = true
    onContinue()
  }

  if (!open) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm px-6",
        "animate-in fade-in duration-200"
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-completion-title"
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
          <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden />
        </div>
        <div>
          <h2 id="checklist-completion-title" className="text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-2 text-muted-foreground text-base">{subtitle}</p>
        </div>
        {seconds > 0 && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Redirigiendo a {redirectPathLabel} en {seconds}s…
          </p>
        )}
        <Button size="lg" className="w-full min-h-12 text-lg" onClick={handleManualContinue}>
          {primaryActionLabel}
        </Button>
      </div>
    </div>
  )
}
