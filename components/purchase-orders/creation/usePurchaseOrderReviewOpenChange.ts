"use client"

import { useCallback, useRef } from "react"
import { toast } from "sonner"

const DISMISS_TOAST_ID = "po-review-dismiss"

/**
 * Toast when the review dialog/sheet closes without confirming create.
 * Call `skipDismissToastRef.current = true` at the start of `performCreate` so
 * programmatic close after confirm does not show the dismiss message.
 */
export function usePurchaseOrderReviewOpenChange(
  setReviewOpen: React.Dispatch<React.SetStateAction<boolean>>
) {
  const skipDismissToastRef = useRef(false)

  const onReviewOpenChange = useCallback(
    (open: boolean) => {
      setReviewOpen((prev) => {
        if (prev && !open && !skipDismissToastRef.current) {
          toast.message(
            "La orden aún no se guarda. Pulse «Confirmar y crear» en el resumen para registrarla.",
            { id: DISMISS_TOAST_ID, duration: 4500 }
          )
        }
        return open
      })
      if (open) skipDismissToastRef.current = false
    },
    [setReviewOpen]
  )

  return { onReviewOpenChange, skipDismissToastRef }
}
