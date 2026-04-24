'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/store'
import {
  computeCoordinatorQuotationPreflightFromUserProfile,
  type PoForCoordinatorQuotationCheck,
} from '@/lib/purchase-orders/coordinator-quotation-mutations'

/**
 * Mirrors the server gate for POST/PATCH/DELETE purchase order quotations so the UI can
 * warn before submit when the session would receive 403.
 */
export function useCoordinatorQuotationPlantGate(
  po: PoForCoordinatorQuotationCheck | null
): {
  showBlocker: boolean
  blockerMessage: string | null
} {
  const { user, profile, isInitialized } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      profile: s.profile,
      isInitialized: s.isInitialized,
    }))
  )

  return useMemo(() => {
    if (!isInitialized || !user?.id || !profile || !po) {
      return { showBlocker: false, blockerMessage: null }
    }
    const pre = computeCoordinatorQuotationPreflightFromUserProfile(user.id, profile, po)
    if (!pre.isViewerCoordinator || pre.coordinatorQuotationUnlocked) {
      return { showBlocker: false, blockerMessage: null }
    }
    return {
      showBlocker: true,
      blockerMessage: pre.blockerMessage,
    }
  }, [isInitialized, user?.id, profile, po])
}
