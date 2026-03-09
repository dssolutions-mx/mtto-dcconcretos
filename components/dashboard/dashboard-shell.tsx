"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface DashboardShellProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DashboardShell({ children, className, ...props }: DashboardShellProps) {
  return (
    <div className={cn("flex-1 space-y-4 p-4 md:p-8 pt-4 md:pt-6 min-h-0", className)} {...props}>
      {children}
    </div>
  )
}
