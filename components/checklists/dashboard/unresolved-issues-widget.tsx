"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export function UnresolvedIssuesWidget() {
  const [unresolvedCount, setUnresolvedCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const loadUnresolvedCount = async () => {
      try {
        const { offlineClient } = await import("@/lib/offline/offline-client")
        const issues = await offlineClient.getUnresolvedIssues()
        if (!cancelled) setUnresolvedCount(issues.length)
      } catch {
        const stored = typeof window !== "undefined" ? localStorage?.getItem("all-unresolved-issues") : null
        if (!cancelled) setUnresolvedCount(stored ? JSON.parse(stored).length : 0)
      }
    }

    void loadUnresolvedCount()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Link href="/checklists/problemas-pendientes" className="block cursor-pointer">
      <Card className="hover:shadow-checklist-2 transition-all duration-200 border-checklist-status-due/30 bg-orange-50/50 dark:bg-orange-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-200">
            Problemas Pendientes
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{unresolvedCount}</div>
          <p className="text-xs text-orange-600 dark:text-orange-400">Requieren órdenes de trabajo</p>
        </CardContent>
      </Card>
    </Link>
  )
}
