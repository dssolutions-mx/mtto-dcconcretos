"use client"

import React, { useState, useEffect } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { PurchaseOrdersListMobile } from "./purchase-orders-list-mobile"
import { ComprasModule } from "@/components/compras/ComprasModule"

interface PurchaseOrdersListProps {
  /** When provided by parent (compras page), skips duplicate auth API fetch */
  effectiveAuthLimitFromParent?: number
  isLoadingAuthFromParent?: boolean
}

/**
 * Thin wrapper: mobile → PurchaseOrdersListMobile; desktop → ComprasModule.
 * Auth limit is passed from parent when available; otherwise fetched for mobile.
 */
export function PurchaseOrdersList({
  effectiveAuthLimitFromParent,
  isLoadingAuthFromParent,
}: PurchaseOrdersListProps = {}) {
  const isMobile = useIsMobile()
  const { profile } = useAuthZustand()
  const [userAuthLimit, setUserAuthLimit] = useState(effectiveAuthLimitFromParent ?? 0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(isLoadingAuthFromParent ?? true)

  useEffect(() => {
    if (effectiveAuthLimitFromParent != null) {
      setUserAuthLimit(effectiveAuthLimitFromParent)
      setIsLoadingAuth(isLoadingAuthFromParent ?? false)
      return
    }
  }, [effectiveAuthLimitFromParent, isLoadingAuthFromParent])

  useEffect(() => {
    if (effectiveAuthLimitFromParent != null || !profile?.id) return
    const load = async () => {
      try {
        const res = await fetch(`/api/authorization/summary?user_id=${profile.id}`)
        const data = await res.json()
        if (!res.ok) {
          setUserAuthLimit(profile.can_authorize_up_to || 0)
          return
        }
        const limit =
          data.user_summary?.effective_global_authorization != null
            ? parseFloat(data.user_summary.effective_global_authorization)
            : data.authorization_scopes?.find((s: { scope_type: string }) => s.scope_type === "global")
                ?.effective_authorization ?? 0
        setUserAuthLimit(limit > 0 || data.user_summary != null ? limit : profile.can_authorize_up_to || 0)
      } catch {
        setUserAuthLimit(profile.can_authorize_up_to || 0)
      } finally {
        setIsLoadingAuth(false)
      }
    }
    load()
  }, [profile, effectiveAuthLimitFromParent])

  if (isMobile) {
    return (
      <PurchaseOrdersListMobile
        effectiveAuthLimitFromParent={userAuthLimit}
        isLoadingAuthFromParent={isLoadingAuth}
      />
    )
  }

  return (
    <ComprasModule
      effectiveAuthLimitFromParent={effectiveAuthLimitFromParent ?? userAuthLimit}
      isLoadingAuthFromParent={isLoadingAuthFromParent ?? isLoadingAuth}
    />
  )
}
