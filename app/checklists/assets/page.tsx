"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Redirect /checklists/assets to /checklists.
 * Asset-centric view is now the primary default on the main checklist page.
 */
export default function AssetChecklistRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/checklists")
  }, [router])

  return null
}
