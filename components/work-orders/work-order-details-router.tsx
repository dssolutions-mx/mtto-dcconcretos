"use client"

import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSearchParams } from "next/navigation"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { ReactNode } from "react"

interface WorkOrderDetailsRouterProps {
  children: ReactNode
}

export function WorkOrderDetailsRouter({ children }: WorkOrderDetailsRouterProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const forceDesktop = searchParams.get("view") === "desktop"

  const handleRefresh = async () => {
    router.refresh()
  }

  if (isMobile && !forceDesktop) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="min-h-[100dvh] md:min-h-0">{children}</div>
      </PullToRefresh>
    )
  }

  return <>{children}</>
}
