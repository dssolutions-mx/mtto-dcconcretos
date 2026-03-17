"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface DashboardShellProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DashboardShell({ children, className, ...props }: DashboardShellProps) {
  return (
    <div className={cn("flex-1 space-y-8 px-4 py-6 md:px-6 md:py-8 min-h-0", className)} {...props}>
      {children}
    </div>
  )
}
