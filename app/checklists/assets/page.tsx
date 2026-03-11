"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function AssetChecklistRedirectInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assetId = searchParams?.get("asset")

  useEffect(() => {
    if (assetId) {
      router.replace(`/checklists/assets/${assetId}`)
    } else {
      router.replace("/checklists")
    }
  }, [router, assetId])

  return null
}

/**
 * Redirect /checklists/assets to /checklists.
 * Asset-centric view is now the primary default on the main checklist page.
 * If ?asset=UUID is present, redirect to /checklists/assets/[id] for direct asset detail.
 */
export default function AssetChecklistRedirect() {
  return (
    <Suspense fallback={null}>
      <AssetChecklistRedirectInner />
    </Suspense>
  )
}
