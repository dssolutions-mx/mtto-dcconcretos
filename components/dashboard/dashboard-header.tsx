"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface DashboardHeaderProps {
  heading: string
  text?: string
  children?: React.ReactNode
  className?: string
  id?: string
}

export function DashboardHeader({ heading, text, children, className, id }: DashboardHeaderProps) {
  return (
    <div id={id} className={cn("flex items-center justify-between", className)}>
      <div className="grid gap-1 min-w-0 flex-1">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{heading}</h1>
        {text && <p className="text-sm md:text-base text-muted-foreground line-clamp-2 md:line-clamp-none">{text}</p>}
      </div>
      {children}
    </div>
  )
}
